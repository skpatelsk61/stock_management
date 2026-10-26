import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../services/notificationService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safe console log with prefix
// ─────────────────────────────────────────────────────────────────────────────
const log = (step, msg, data = '') =>
  console.log(`[VendorReturn][${step}] ${msg}`, data !== '' ? data : '');

const errLog = (step, msg, err) =>
  console.error(`[VendorReturn][ERROR][${step}] ${msg}`, err?.message || err, err?.code || '');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all vendor stock returns (filtered by vendor, status, or search)
// @route   GET /api/vendor-returns
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getVendorReturns = async (req, res, next) => {
  try {
    const { vendor_id, status, search, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = `
      SELECT pr.*, 
             p.name as product_name, p.barcode, p.unit, p.sku, p.measurement_value,
             v.name as vendor_name, v.company_name as vendor_company, v.supplier_code,
             v.phone as vendor_phone, v.gstin as vendor_gstin, v.address as vendor_address,
             w.name as warehouse_name
      FROM purchase_returns pr
      JOIN products p ON pr.product_id = p.id
      JOIN vendors v ON pr.vendor_id = v.id
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      WHERE 1=1
    `;
    const queryParams = [];

    if (vendor_id) {
      query += ' AND pr.vendor_id = ?';
      queryParams.push(Number(vendor_id));
    }

    if (status && status !== 'all') {
      query += ' AND pr.status = ?';
      queryParams.push(status);
    }

    if (search && search.trim() !== '') {
      query += ' AND (pr.return_no LIKE ? OR pr.purchase_no LIKE ? OR p.name LIKE ? OR v.name LIKE ? OR v.company_name LIKE ?)';
      const s = `%${search.trim()}%`;
      queryParams.push(s, s, s, s, s);
    }

    query += ' ORDER BY pr.created_at DESC, pr.id DESC';

    const [rows] = await req.db.query(query, queryParams);

    // Consolidate rows by return_no (1 Return Note Invoice for all products returned in that transaction)
    const invoiceMap = new Map();
    for (const r of rows) {
      const rNo = r.return_no;
      if (!invoiceMap.has(rNo)) {
        invoiceMap.set(rNo, {
          id: r.id,
          return_no: rNo,
          created_at: r.created_at,
          vendor_id: r.vendor_id,
          vendor_name: r.vendor_name,
          vendor_company_name: r.vendor_company || r.vendor_name,
          vendor_company: r.vendor_company,
          supplier_code: r.supplier_code,
          vendor_phone: r.vendor_phone,
          vendor_gstin: r.vendor_gstin,
          vendor_address: r.vendor_address,
          warehouse_id: r.warehouse_id,
          warehouse_name: r.warehouse_name,
          purchase_id: r.purchase_id,
          purchase_no: r.purchase_no,
          status: r.status,
          return_type: r.return_type || 'Refund',
          reason: r.reason,
          remarks: r.remarks,
          image_url: r.image_url,
          batch_number: r.batch_number,
          expiry_date: r.expiry_date,
          item_count: 0,
          quantity: 0,
          total_amount: 0,
          purchase_invoices: new Set(),
          batches: new Set(),
          items: []
        });
      }

      const inv = invoiceMap.get(rNo);
      inv.item_count += 1;
      inv.quantity += Number(r.quantity || 0);
      inv.total_amount += Number(r.total_amount || 0);
      if (r.purchase_no) inv.purchase_invoices.add(r.purchase_no);
      if (r.batch_number) inv.batches.add(r.batch_number);

      inv.items.push({
        id: r.id,
        return_no: rNo,
        product_id: r.product_id,
        product_name: r.product_name,
        measurement_value: r.measurement_value,
        sku: r.sku,
        barcode: r.barcode,
        unit: r.unit,
        quantity: Number(r.quantity || 0),
        return_price: Number(r.return_price || 0),
        total_amount: Number(r.total_amount || 0),
        purchase_id: r.purchase_id,
        purchase_no: r.purchase_no,
        batch_number: r.batch_number || r.purchase_no || '—',
        expiry_date: r.expiry_date,
        reason: r.reason,
        return_type: r.return_type || 'Refund',
        status: r.status
      });
    }

    const consolidatedReturns = Array.from(invoiceMap.values()).map((inv) => {
      const distinctInvoices = Array.from(inv.purchase_invoices);
      const distinctBatches = Array.from(inv.batches);
      const prodSummary = inv.items.map((it) => `${it.product_name} (${it.quantity} Pcs)`).join(', ');
      return {
        ...inv,
        purchase_no: distinctInvoices.length > 0 ? distinctInvoices.join(', ') : (inv.purchase_no || '—'),
        purchase_invoices: distinctInvoices,
        batch_number: distinctBatches.length > 1 ? 'Multi-Batch' : (distinctBatches[0] || inv.batch_number || '—'),
        batches: distinctBatches,
        product_name: prodSummary,
        total_amount: Number(inv.total_amount.toFixed(2))
      };
    });

    const paginatedReturns = consolidatedReturns.slice(offset, offset + Number(limit));

    return res.status(200).json({
      success: true,
      count: consolidatedReturns.length,
      returns: paginatedReturns
    });
  } catch (error) {
    errLog('getVendorReturns', 'Failed to fetch vendor returns', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get products that were purchased from a specific vendor
// @route   GET /api/vendor-returns/products-purchased?vendor_id=X
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getProductsPurchasedByVendor = async (req, res, next) => {
  try {
    const { vendor_id } = req.query;
    if (!vendor_id) {
      return res.status(400).json({ success: false, message: 'vendor_id query parameter is required' });
    }

    const vId = Number(vendor_id);
    const [products] = await req.db.query(
      `SELECT p.id, p.name, 
              COALESCE(b.name, p.brand) as brand, 
              p.measurement_value, 
              p.sku, p.barcode, p.unit, p.purchase_price, p.gst,
              COALESCE((SELECT SUM(quantity) FROM stock WHERE product_id = p.id), 0) as current_stock,
              COALESCE(
                NULLIF(
                  COALESCE((
                    SELECT SUM(pi2.quantity)
                    FROM purchase_items pi2
                    JOIN purchases pu2 ON pi2.purchase_id = pu2.id
                    WHERE pu2.vendor_id = ? AND pi2.product_id = p.id
                  ), 0) - COALESCE((
                    SELECT SUM(pr2.quantity)
                    FROM purchase_returns pr2
                    WHERE pr2.vendor_id = ? AND pr2.product_id = p.id AND pr2.status != 'Void'
                  ), 0),
                  0
                ),
                COALESCE((
                  SELECT SUM(pi3.quantity)
                  FROM purchase_items pi3
                  JOIN purchases pu3 ON pi3.purchase_id = pu3.id
                  JOIN products p3 ON pi3.product_id = p3.id
                  WHERE pu3.vendor_id = ?
                    AND (
                      (p.brand_id IS NOT NULL AND p3.brand_id = p.brand_id AND LOWER(TRIM(p3.name)) = LOWER(TRIM(p.name)))
                      OR (LOWER(TRIM(COALESCE(p3.brand, ''))) = LOWER(TRIM(COALESCE(p.brand, ''))) AND LOWER(TRIM(p3.name)) = LOWER(TRIM(p.name)))
                    )
                ), 0) - COALESCE((
                  SELECT SUM(pr3.quantity)
                  FROM purchase_returns pr3
                  WHERE pr3.vendor_id = ? AND pr3.product_id = p.id AND pr3.status != 'Void'
                ), 0),
                0
              ) as total_purchased_from_vendor
       FROM products p
       LEFT JOIN brands b ON p.brand_id = b.id
       WHERE (
         p.id IN (
           SELECT DISTINCT pi.product_id
           FROM purchase_items pi
           JOIN purchases pu ON pi.purchase_id = pu.id
           WHERE pu.vendor_id = ?
         )
         OR (LOWER(TRIM(p.name)), COALESCE(p.brand_id, 0)) IN (
           SELECT DISTINCT LOWER(TRIM(p2.name)), COALESCE(p2.brand_id, 0)
           FROM products p2
           JOIN purchase_items pi2 ON p2.id = pi2.product_id
           JOIN purchases pu2 ON pi2.purchase_id = pu2.id
           WHERE pu2.vendor_id = ?
         )
         OR (LOWER(TRIM(p.name)), LOWER(TRIM(COALESCE(b.name, p.brand, '')))) IN (
           SELECT DISTINCT LOWER(TRIM(p3.name)), LOWER(TRIM(COALESCE(b3.name, p3.brand, '')))
           FROM products p3
           LEFT JOIN brands b3 ON p3.brand_id = b3.id
           JOIN purchase_items pi3 ON p3.id = pi3.product_id
           JOIN purchases pu3 ON pi3.purchase_id = pu3.id
           WHERE pu3.vendor_id = ?
         )
       )
       ORDER BY p.name ASC, p.id ASC`,
      [vId, vId, vId, vId, vId, vId, vId]
    );

    return res.status(200).json({ success: true, products });
  } catch (error) {
    errLog('getProductsPurchasedByVendor', 'Failed to fetch vendor products', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get purchase invoices for a specific vendor + product combination
// @route   GET /api/vendor-returns/purchases-by-product?vendor_id=X&product_id=Y
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getPurchasesForVendorProduct = async (req, res, next) => {
  try {
    const { vendor_id, product_id } = req.query;
    if (!vendor_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'Both vendor_id and product_id query parameters are required'
      });
    }

    const vId = Number(vendor_id);
    const pId = Number(product_id);

    // Fetch current physical stock for the product
    const [stockRec] = await req.db.query(
      'SELECT COALESCE(SUM(quantity), 0) as currentStock FROM stock WHERE product_id = ?',
      [pId]
    );
    const currentStock = Number(stockRec[0]?.currentStock || 0);

    // 1. Try direct purchases for this specific product_id
    let [purchases] = await req.db.query(
      `SELECT pu.id as purchaseId, 
              pu.purchase_no as purchaseNo, 
              pu.purchase_no, 
              pu.date as purchaseDate, 
              pu.date, 
              pu.payment_status,
              pi.purchase_price as purchasePrice, 
              pi.quantity as purchasedQuantity,
              pi.quantity as purchaseQuantity,
              pi.gst,
              COALESCE(pb.batch_number, pu.purchase_no, '—') as batchNo,
              pb.expiry_date as expiryDate,
              COALESCE((
                SELECT SUM(pr.quantity)
                FROM purchase_returns pr
                WHERE pr.purchase_id = pu.id
                  AND pr.product_id  = pi.product_id
                  AND pr.status != 'Void'
              ), 0) as returnedQuantity
       FROM purchase_items pi
       JOIN purchases pu ON pi.purchase_id = pu.id
       LEFT JOIN purchase_batches pb ON pb.purchase_id = pu.id AND pb.product_id = pi.product_id
       WHERE pu.vendor_id  = ?
         AND pi.product_id = ?
       ORDER BY pu.date DESC`,
      [vId, pId]
    );

    // 2. If no direct purchase item rows exist for this specific weight variant,
    // match purchase invoices from this vendor for the same product family (name & brand)
    if (purchases.length === 0) {
      const [familyPurchases] = await req.db.query(
        `SELECT pu.id as purchaseId, 
                pu.purchase_no as purchaseNo, 
                pu.purchase_no, 
                pu.date as purchaseDate, 
                pu.date, 
                pu.payment_status,
                COALESCE(target_p.purchase_price, ANY_VALUE(pi.purchase_price), 0) as purchasePrice, 
                SUM(pi.quantity) as purchasedQuantity,
                SUM(pi.quantity) as purchaseQuantity,
                COALESCE(target_p.gst, ANY_VALUE(pi.gst), 0) as gst,
                COALESCE(ANY_VALUE(pb.batch_number), pu.purchase_no, '—') as batchNo,
                ANY_VALUE(pb.expiry_date) as expiryDate,
                COALESCE((
                  SELECT SUM(pr.quantity)
                  FROM purchase_returns pr
                  WHERE pr.purchase_id = pu.id
                    AND pr.product_id  = target_p.id
                    AND pr.status != 'Void'
                ), 0) as returnedQuantity
         FROM purchase_items pi
         JOIN purchases pu ON pi.purchase_id = pu.id
         JOIN products p_orig ON pi.product_id = p_orig.id
         JOIN products target_p ON target_p.id = ?
         LEFT JOIN purchase_batches pb ON pb.purchase_id = pu.id AND pb.product_id = target_p.id
         WHERE pu.vendor_id = ?
           AND (
             (target_p.brand_id IS NOT NULL AND p_orig.brand_id = target_p.brand_id AND LOWER(TRIM(p_orig.name)) = LOWER(TRIM(target_p.name)))
             OR (LOWER(TRIM(COALESCE(p_orig.brand, ''))) = LOWER(TRIM(COALESCE(target_p.brand, ''))) AND LOWER(TRIM(p_orig.name)) = LOWER(TRIM(target_p.name)))
           )
         GROUP BY pu.id, pu.purchase_no, pu.date, pu.payment_status, target_p.purchase_price, target_p.gst, target_p.id
         ORDER BY pu.date DESC`,
        [pId, vId]
      );
      purchases = familyPurchases;
    }

    // 3. Fallback: if vendor has purchases and product belongs to this vendor
    if (purchases.length === 0) {
      const [vendorPurch] = await req.db.query(
        `SELECT pu.id as purchaseId, 
                pu.purchase_no as purchaseNo, 
                pu.purchase_no, 
                pu.date as purchaseDate, 
                pu.date, 
                pu.payment_status,
                COALESCE(p.purchase_price, 0) as purchasePrice,
                1 as purchasedQuantity,
                1 as purchaseQuantity,
                COALESCE(p.gst, 0) as gst,
                pu.purchase_no as batchNo,
                NULL as expiryDate,
                0 as returnedQuantity
         FROM purchases pu
         CROSS JOIN products p
         WHERE pu.vendor_id = ? AND p.id = ?
         ORDER BY pu.date DESC LIMIT 1`,
        [vId, pId]
      );
      purchases = vendorPurch;
    }

    const mappedPurchases = purchases.map(p => {
      const purchasedQty = Number(p.purchasedQuantity || p.purchaseQuantity || 0);
      const returnedQty = Number(p.returnedQuantity || 0);
      const netPurchased = Math.max(0, purchasedQty - returnedQty);
      // Available return quantity cannot exceed physical stock in hand!
      const availableReturnQuantity = Math.max(0, Math.min(netPurchased > 0 ? netPurchased : currentStock, currentStock));
      return {
        ...p,
        purchaseNo: p.purchaseNo || p.purchase_no,
        purchaseDate: p.purchaseDate || p.date,
        purchaseQuantity: purchasedQty,
        availableReturnQuantity
      };
    });

    return res.status(200).json({ success: true, purchases: mappedPurchases, currentStock });
  } catch (error) {
    errLog('getPurchasesForVendorProduct', 'Failed to fetch purchase records for product', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get available stock for a vendor/product pair
// @route   GET /api/vendor-returns/available-stock?vendor_id=X&product_id=Y
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getAvailableReturnStock = async (req, res, next) => {
  try {
    const { vendor_id, product_id } = req.query;
    if (!vendor_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: 'vendor_id and product_id are required'
      });
    }

    const vId = Number(vendor_id);
    const pId = Number(product_id);

    const [stock] = await req.db.query(
      'SELECT COALESCE(SUM(quantity), 0) as available FROM stock WHERE product_id = ?',
      [pId]
    );

    let [purchases] = await req.db.query(
      `SELECT COALESCE(SUM(pi.quantity), 0) as totalPurchased
       FROM purchase_items pi
       JOIN purchases pu ON pi.purchase_id = pu.id
       WHERE pu.vendor_id = ? AND pi.product_id = ?`,
      [vId, pId]
    );

    let totalPurchased = Number(purchases[0]?.totalPurchased || 0);
    if (totalPurchased === 0) {
      const [familyPurchases] = await req.db.query(
        `SELECT COALESCE(SUM(pi.quantity), 0) as totalPurchased
         FROM purchase_items pi
         JOIN purchases pu ON pi.purchase_id = pu.id
         JOIN products p_orig ON pi.product_id = p_orig.id
         JOIN products target_p ON target_p.id = ?
         WHERE pu.vendor_id = ?
           AND (
             (target_p.brand_id IS NOT NULL AND p_orig.brand_id = target_p.brand_id AND LOWER(TRIM(p_orig.name)) = LOWER(TRIM(target_p.name)))
             OR (LOWER(TRIM(COALESCE(p_orig.brand, ''))) = LOWER(TRIM(COALESCE(target_p.brand, ''))) AND LOWER(TRIM(p_orig.name)) = LOWER(TRIM(target_p.name)))
           )`,
        [pId, vId]
      );
      totalPurchased = Number(familyPurchases[0]?.totalPurchased || 0);
    }

    const [returned] = await req.db.query(
      `SELECT COALESCE(SUM(quantity), 0) as totalReturned
       FROM purchase_returns
       WHERE vendor_id = ? AND product_id = ? AND status != 'Void'`,
      [vId, pId]
    );

    const availableStock = Number(stock[0]?.available || 0);
    const totalReturned = Number(returned[0]?.totalReturned || 0);
    // Capped by physical stock in hand!
    const effectivePurchased = totalPurchased > 0 ? totalPurchased : availableStock;
    const maxReturnable = Math.max(0, Math.min(effectivePurchased - totalReturned, availableStock));

    return res.status(200).json({
      success: true,
      availableStock: availableStock,
      maxReturnableQty: maxReturnable,
      totalPurchased: effectivePurchased,
      totalReturned
    });
  } catch (error) {
    errLog('getAvailableReturnStock', 'Failed to fetch available return stock', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get Supplier Ledger analytics for a given vendor
// @route   GET /api/vendor-returns/ledger/:vendorId
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const getSupplierLedger = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    if (!vendorId) {
      return res.status(400).json({ success: false, message: 'vendorId param is required' });
    }

    const vid = Number(vendorId);

    // Vendor basic info
    const [vendorRows] = await req.db.query('SELECT * FROM vendors WHERE id = ?', [vid]);
    if (vendorRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    const vendor = vendorRows[0];

    // Totals
    const [purchasesSum] = await req.db.query(
      'SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE vendor_id = ? AND payment_status != "Void"', [vid]
    );
    const [returnsValSum] = await req.db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM purchase_returns WHERE vendor_id = ? AND status != 'Void'", [vid]
    );
    const [refundsValSum] = await req.db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_returns WHERE vendor_id = ? AND status != 'Void' AND (return_type IS NULL OR return_type = 'Refund' OR return_type = 'Refund / Store Credit')", [vid]
    );
    const [replacementsPendingSum] = await req.db.query(
      "SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM purchase_returns WHERE vendor_id = ? AND status != 'Void' AND return_type = 'Replacement' AND status NOT IN ('Replacement Received', 'Closed')", [vid]
    );
    const [paymentsSum] = await req.db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE vendor_id = ?', [vid]
    );
    const [lastReturnRow] = await req.db.query(
      "SELECT created_at FROM purchase_returns WHERE vendor_id = ? AND status != 'Void' ORDER BY created_at DESC LIMIT 1", [vid]
    );

    const grossPurchases = Number(purchasesSum[0]?.total || 0);
    const totalReturnVal = Number(returnsValSum[0]?.total || 0);
    const totalReturnCount = Number(returnsValSum[0]?.count || 0);
    const totalRefundReceivedVal = Number(refundsValSum[0]?.total || 0);
    const replacementPendingCount = Number(replacementsPendingSum[0]?.count || 0);
    const replacementPendingVal = Number(replacementsPendingSum[0]?.total || 0);
    const totalPaid = Number(paymentsSum[0]?.total || 0);
    const lastReturnDate = lastReturnRow[0]?.created_at || null;

    const netObligations = Math.max(0, grossPurchases - totalReturnVal);
    const openingBal = vendor.opening_balance_type === 'Advance'
      ? -Number(vendor.opening_balance || 0)
      : Number(vendor.opening_balance || 0);
    const diff = netObligations + openingBal - totalPaid;
    const outstandingBalance = diff > 0 ? Number(diff.toFixed(2)) : 0;
    const advanceBalance = diff < 0 ? Number(Math.abs(diff).toFixed(2)) : 0;

    const analytics = {
      vendorId: vid,
      vendorName: vendor.name,
      companyName: vendor.company_name || vendor.name,
      gstin: vendor.gstin || '',
      phone: vendor.phone || vendor.contact || '',
      totalPurchases: Number(grossPurchases.toFixed(2)),
      grossPurchases: Number(grossPurchases.toFixed(2)),
      totalReturns: totalReturnCount,
      totalReturnsCount: totalReturnCount,
      totalReturnPriceValue: Number(totalReturnVal.toFixed(2)),
      totalRefundReceived: Number(totalRefundReceivedVal.toFixed(2)),
      replacementPendingCount,
      replacementPendingValue: Number(replacementPendingVal.toFixed(2)),
      netPurchases: Number(netObligations.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      outstandingBalance,
      advanceBalance,
      openingBalance: Number(vendor.opening_balance || 0),
      openingBalanceType: vendor.opening_balance_type || 'Debit',
      lastReturnDate
    };

    // Return history for this vendor
    const [history] = await req.db.query(
      `SELECT pr.*, p.name as product_name
       FROM purchase_returns pr
       JOIN products p ON pr.product_id = p.id
       WHERE pr.vendor_id = ?
       ORDER BY pr.created_at DESC`,
      [vid]
    );

    return res.status(200).json({ success: true, analytics, history });
  } catch (error) {
    errLog('getSupplierLedger', 'Failed to fetch supplier ledger', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update vendor return note status
// @route   PUT /api/vendor-returns/:id/status
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const updateVendorReturnStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      'Pending', 'Sent to Vendor', 'Acknowledged', 'Refund Received', 'Replacement Received', 'Closed', 'Void'
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const [existing] = await req.db.query(
      'SELECT id, return_no, status FROM purchase_returns WHERE id = ? OR return_no = ? LIMIT 1', [id, id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Return note not found' });
    }

    const returnNo = existing[0].return_no;

    await req.db.query(
      'UPDATE purchase_returns SET status = ? WHERE return_no = ?',
      [status, returnNo]
    );

    // Record status history if the table exists
    try {
      await req.db.query(
        `INSERT INTO purchase_return_status_history (purchase_return_id, status, user_name, notes)
         VALUES (?, ?, ?, ?)`,
        [id, status, req.user?.name || 'System', notes || null]
      );
    } catch (histErr) {
      // Non-fatal: status history table might not exist in older deployments
      log('updateStatus', 'Warning: Could not insert status history (table may not exist)', histErr.message);
    }

    log('updateStatus', `Return note ${existing[0].return_no} status updated to "${status}"`);

    return res.status(200).json({
      success: true,
      message: `Return note status updated to "${status}" successfully`
    });
  } catch (error) {
    errLog('updateVendorReturnStatus', 'Failed to update status', error);
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Create Vendor Purchase Return Note (full transaction)
// @route   POST /api/vendor-returns
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const createVendorReturn = async (req, res, next) => {
  const connection = await req.db.getConnection();
  log('createVendorReturn', 'Starting vendor return creation. Payload:', JSON.stringify(req.body));

  try {
    await connection.beginTransaction();
    log('createVendorReturn', 'Transaction started');

    const {
      vendor_id,
      purchase_id,
      product_id,
      quantity,
      items, // array of { product_id, quantity, return_price }
      reason,
      return_type = 'Refund',
      remarks = '',
      batch_number,
      expiry_date,
      image_url
    } = req.body;

    const tenantId = req.tenantId;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!vendor_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Required field missing: vendor_id' });
    }
    if (!reason) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'Required field missing: reason for return' });
    }

    // Verify vendor exists
    const [vendorCheck] = await connection.query('SELECT id, name FROM vendors WHERE id = ?', [Number(vendor_id)]);
    if (vendorCheck.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: `Supplier not found for vendor_id: ${vendor_id}` });
    }
    const vendorName = vendorCheck[0].name;
    log('createVendorReturn', `Supplier verified: ${vendorName} (id=${vendor_id})`);

    // Build process items list
    let processItems = [];
    if (Array.isArray(items) && items.length > 0) {
      processItems = items.map(i => ({
        product_id: Number(i.product_id),
        quantity: Number(i.quantity),
        return_price: i.return_price ? Number(i.return_price) : null,
        purchase_id: i.purchase_id ? Number(i.purchase_id) : (purchase_id ? Number(purchase_id) : null),
        purchase_no: i.purchase_no || null,
        batch_number: i.batch_number || batch_number || null,
        expiry_date: i.expiry_date || expiry_date || null,
        reason: i.reason || reason,
        return_type: i.return_type || return_type
      }));
    } else if (product_id && Number(quantity) > 0) {
      processItems = [{
        product_id: Number(product_id),
        quantity: Number(quantity),
        return_price: req.body.return_price ? Number(req.body.return_price) : null,
        purchase_id: purchase_id ? Number(purchase_id) : null,
        purchase_no: null,
        batch_number: batch_number || null,
        expiry_date: expiry_date || null,
        reason: reason,
        return_type: return_type
      }];
    }

    if (processItems.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: 'Please select at least one valid product with a return quantity greater than 0'
      });
    }

    log('createVendorReturn', `Processing ${processItems.length} item(s)`);

    // ── Generate unique PRN Return Note number safely
    const [allPRNs] = await connection.query('SELECT return_no FROM purchase_returns WHERE return_no LIKE ?', ['PRN-%']);
    let maxSeq = 0;
    for (const row of allPRNs) {
      const parts = row.return_no.split('-');
      const seq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
    const vrnNo = `PRN-${String(maxSeq + 1).padStart(5, '0')}`;
    log('createVendorReturn', `Generated VRN: ${vrnNo}`);

    // ── Fetch purchase_no if purchase_id supplied ────────────────────────────
    let purchaseNo = null;
    if (purchase_id) {
      const [purchInfo] = await connection.query(
        'SELECT purchase_no FROM purchases WHERE id = ?', [Number(purchase_id)]
      );
      if (purchInfo.length > 0) {
        purchaseNo = purchInfo[0].purchase_no;
        log('createVendorReturn', `Linked to purchase invoice: ${purchaseNo}`);
      } else {
        log('createVendorReturn', `Warning: purchase_id=${purchase_id} not found – continuing without invoice link`);
      }
    }

    let totalReturnVal = 0;
    let createdReturnId = null;

    // ── Process each return item ─────────────────────────────────────────────
    for (const [idx, item] of processItems.entries()) {
      const pId = item.product_id;
      const retQty = item.quantity;
      log('createVendorReturn', `Item ${idx + 1}/${processItems.length}: product_id=${pId}, qty=${retQty}`);

      // Validate product exists
      const [productCheck] = await connection.query('SELECT id, name, purchase_price FROM products WHERE id = ?', [pId]);
      if (productCheck.length === 0) {
        throw new Error(`Product not found for product_id: ${pId}. Please select a valid product.`);
      }
      log('createVendorReturn', `Product verified: ${productCheck[0].name}`);

      // Validate that this product was purchased from this vendor (direct variant or matching product family)
      const [vendorPurchCheck] = await connection.query(
        `SELECT 1 FROM purchase_items pi
         JOIN purchases pu ON pi.purchase_id = pu.id
         JOIN products p_purch ON pi.product_id = p_purch.id
         JOIN products target_p ON target_p.id = ?
         WHERE pu.vendor_id = ? 
           AND (
             pi.product_id = target_p.id
             OR (
               (target_p.brand_id IS NOT NULL AND p_purch.brand_id = target_p.brand_id AND LOWER(TRIM(p_purch.name)) = LOWER(TRIM(target_p.name)))
               OR (LOWER(TRIM(COALESCE(p_purch.brand, ''))) = LOWER(TRIM(COALESCE(target_p.brand, ''))) AND LOWER(TRIM(p_purch.name)) = LOWER(TRIM(target_p.name)))
             )
           )
         LIMIT 1`,
        [pId, Number(vendor_id)]
      );
      if (vendorPurchCheck.length === 0) {
        throw new Error(
          `Validation Error: Product "${productCheck[0].name}" was never purchased from "${vendorName}". ` +
          `A product can only be returned to the supplier from whom it was purchased.`
        );
      }

      // Determine item's specific purchase invoice link
      let itemPurchaseId = item.purchase_id || purchase_id || null;
      let itemPurchaseNo = item.purchase_no || null;
      if (itemPurchaseId && !itemPurchaseNo) {
        const [pInfo] = await connection.query(
          'SELECT purchase_no FROM purchases WHERE id = ?', [Number(itemPurchaseId)]
        );
        if (pInfo.length > 0) {
          itemPurchaseNo = pInfo[0].purchase_no;
        }
      }
      if (!itemPurchaseNo) {
        itemPurchaseNo = purchaseNo;
      }

      // Determine return unit price
      let unitPrice = item.return_price || 0;
      if (!unitPrice && itemPurchaseId) {
        const [piCheck] = await connection.query(
          'SELECT purchase_price FROM purchase_items WHERE purchase_id = ? AND product_id = ?',
          [Number(itemPurchaseId), pId]
        );
        if (piCheck.length > 0) {
          unitPrice = Number(piCheck[0].purchase_price);
          log('createVendorReturn', `Unit price from purchase invoice: ₹${unitPrice}`);
        }
      }
      if (!unitPrice) {
        unitPrice = Number(productCheck[0].purchase_price || 0);
        log('createVendorReturn', `Unit price from product master: ₹${unitPrice}`);
      }

      const itemTotal = unitPrice * retQty;
      totalReturnVal += itemTotal;
      log('createVendorReturn', `Item total: ₹${itemTotal} | Running total: ₹${totalReturnVal}`);

      // ── Step 1: Fetch warehouse for this product's stock ─────────────────
      const [stockRec] = await connection.query(
        'SELECT id, warehouse_id, quantity FROM stock WHERE product_id = ? ORDER BY id LIMIT 1',
        [pId]
      );
      const targetWarehouseId = stockRec.length > 0 ? stockRec[0].warehouse_id : null;
      const currentStockQty = stockRec.length > 0 ? Number(stockRec[0].quantity || 0) : 0;

      if (!targetWarehouseId) {
        throw new Error(
          `No stock record found for product "${productCheck[0].name}". Cannot determine warehouse. ` +
          `Ensure stock has been received before processing a return.`
        );
      }

      if (retQty > currentStockQty) {
        throw new Error(
          `Cannot return ${retQty} units of "${productCheck[0].name}". Only ${currentStockQty} units are currently present in physical stock.`
        );
      }
      log('createVendorReturn', `Target warehouse_id: ${targetWarehouseId}, Current stock: ${currentStockQty}`);

      // ── Step 2: Deduct Stock ─────────────────────────────────────────────
      log('createVendorReturn', `Deducting ${retQty} units from stock (product=${pId}, warehouse=${targetWarehouseId})`);
      await connection.query(
        'UPDATE stock SET quantity = GREATEST(0, quantity - ?) WHERE product_id = ? AND warehouse_id = ?',
        [retQty, pId, targetWarehouseId]
      );

      // ── Step 2b: Deduct Stock in purchase_batches table (so Products Page total_stock updates!) ──
      try {
        await connection.query(
          `UPDATE purchase_batches 
           SET remaining_quantity = GREATEST(0, remaining_quantity - ?) 
           WHERE product_id = ? AND (supplier_id = ? OR purchase_id = ?) AND remaining_quantity > 0 
           ORDER BY id DESC LIMIT 1`,
          [retQty, pId, Number(vendor_id), itemPurchaseId ? Number(itemPurchaseId) : 0]
        );
      } catch (pbErr) {
        log('createVendorReturn', 'Warning: Could not update purchase_batches', pbErr.message);
      }

      // ── Step 3: Log Stock Movement ────────────────────────────────────────
      const itemReason = item.reason || reason;
      const itemReturnType = item.return_type || return_type;
      const itemBatchNo = item.batch_number || batch_number || null;
      const itemExpiryDate = item.expiry_date || expiry_date || null;

      log('createVendorReturn', 'Inserting stock_logs entry');
      await connection.query(
        `INSERT INTO stock_logs (product_id, warehouse_id, vendor_id, type, quantity, reference_no, notes, user_id)
         VALUES (?, ?, ?, 'Stock Out', ?, ?, ?, ?)`,
        [
          pId,
          targetWarehouseId,
          Number(vendor_id),
          -Math.abs(retQty),
          vrnNo,
          `Supplier Return (${itemReturnType}): ${itemReason}`,
          req.user.id || null
        ]
      );
      log('createVendorReturn', 'Stock log inserted successfully');

      // ── Step 4: Insert purchase_returns row ───────────────────────────────
      log('createVendorReturn', 'Inserting purchase_returns record');
      const [insertRes] = await connection.query(
        `INSERT INTO purchase_returns (
          purchase_id, purchase_no, vendor_id, product_id, warehouse_id,
          quantity, return_price, total_amount, reason, return_no,
          return_type, remarks, batch_number, expiry_date, image_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved')`,
        [
          itemPurchaseId,
          itemPurchaseNo,
          Number(vendor_id),
          pId,
          targetWarehouseId,
          retQty,
          unitPrice,
          itemTotal,
          itemReason,
          vrnNo,
          itemReturnType,
          remarks || null,
          itemBatchNo,
          itemExpiryDate,
          image_url || null
        ]
      );
      log('createVendorReturn', `purchase_returns row inserted. insertId=${insertRes.insertId}`);

      if (!createdReturnId) {
        createdReturnId = insertRes.insertId;
      }
    }

    // ── Step 5: Update Vendor Financial Balance (Single Source of Truth) ──────────────────────
    log('createVendorReturn', `Updating vendor balance. totalReturnVal=₹${totalReturnVal}`);
    const [invSumSync] = await connection.query('SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE vendor_id = ? AND payment_status != "Void"', [Number(vendor_id)]);
    const [retSumSync] = await connection.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_returns WHERE vendor_id = ? AND status != "Void"', [Number(vendor_id)]);
    const [paySumSync] = await connection.query('SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE vendor_id = ?', [Number(vendor_id)]);
    const [vRowSync] = await connection.query('SELECT opening_balance, opening_balance_type FROM vendors WHERE id = ?', [Number(vendor_id)]);

    if (vRowSync.length > 0) {
      const grossPSync = Number(invSumSync[0].total || 0);
      const retPSync = Number(retSumSync[0].total || 0);
      const netPSync = Math.max(0, grossPSync - retPSync);
      const openBSync = vRowSync[0].opening_balance_type === 'Advance' ? -Number(vRowSync[0].opening_balance || 0) : Number(vRowSync[0].opening_balance || 0);
      const totPaidSync = Number(paySumSync[0].total || 0);

      const diffSync = (netPSync + openBSync) - totPaidSync;
      const newOut = diffSync > 0.005 ? Number(diffSync.toFixed(2)) : 0;
      const newAdv = diffSync < -0.005 ? Number(Math.abs(diffSync).toFixed(2)) : 0;

      await connection.query(
        'UPDATE vendors SET total_purchases = ?, total_paid = ?, outstanding_balance = ?, advance_balance = ? WHERE id = ?',
        [grossPSync, totPaidSync, newOut, newAdv, Number(vendor_id)]
      );
    }
    log('createVendorReturn', 'Vendor balance updated');

    // ── Commit Transaction ────────────────────────────────────────────────────
    await connection.commit();
    log('createVendorReturn', `Transaction COMMITTED successfully. VRN: ${vrnNo}`);

    // ── Post-commit: Activity Log & Notification (non-fatal) ─────────────────
    try {
      await logActivity(
        req.user.id,
        'Process Purchase Return',
        'Stock',
        `Processed purchase return ${vrnNo} for supplier "${vendorName}" (ID: ${vendor_id}) — Return Value: ₹${totalReturnVal.toFixed(2)}`,
        req.ip
      );
    } catch (actErr) {
      log('createVendorReturn', 'Warning: Activity logging failed (non-fatal)', actErr.message);
    }

    try {
      await createNotification({
        type: 'Stock Return',
        title: 'Purchase Return Note Posted',
        message: `Purchase Return Note "${vrnNo}" created for supplier "${vendorName}" (Value: ₹${totalReturnVal.toFixed(2)}).`,
        priority: 'Medium',
        related_user: req.user.email,
        related_module: 'Returns',
        target_roles: 'Admin,Manager,Staff'
      }, req.db);
    } catch (notifErr) {
      log('createVendorReturn', 'Warning: Notification creation failed (non-fatal)', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Vendor return note ${vrnNo} posted successfully. Stock updated and supplier balance adjusted.`,
      vrn: vrnNo,
      returnId: createdReturnId,
      totalAmount: Number(totalReturnVal.toFixed(2))
    });

  } catch (error) {
    errLog('createVendorReturn', 'Error — rolling back transaction', error);
    try {
      await connection.rollback();
      log('createVendorReturn', 'Transaction rolled back');
    } catch (rbErr) {
      errLog('createVendorReturn', 'Failed to rollback transaction', rbErr);
    }

    // Pass a descriptive error to the global error handler
    const detailedError = new Error(
      `Vendor return failed: ${error.message}` +
      (error.code ? ` [DB Code: ${error.code}]` : '')
    );
    detailedError.status = error.status || 500;
    detailedError.code = error.code;
    detailedError.originalError = error.message;
    next(detailedError);
  } finally {
    try { connection.release(); } catch (_) {}
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete (Void) a vendor return note and reverse all changes
// @route   DELETE /api/vendor-returns/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
export const deleteVendorReturn = async (req, res, next) => {
  const connection = await req.db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const [targetRows] = await connection.query(
      'SELECT * FROM purchase_returns WHERE id = ? OR return_no = ?', [id, id]
    );

    if (targetRows.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: 'Return note not found' });
    }

    const returnNo = targetRows[0].return_no;
    const vendorId = targetRows[0].vendor_id;

    // Fetch all active items under this return note
    const [allRelatedItems] = await connection.query(
      'SELECT * FROM purchase_returns WHERE return_no = ? AND status != "Void"',
      [returnNo]
    );

    if (allRelatedItems.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: 'This return note has already been voided' });
    }

    log('deleteVendorReturn', `Voiding entire return note ${returnNo} containing ${allRelatedItems.length} item(s)`);

    // Restore stock and log movement for each returned item
    for (const ret of allRelatedItems) {
      await connection.query(
        'UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?',
        [ret.quantity, ret.product_id, ret.warehouse_id]
      );

      try {
        if (ret.purchase_id) {
          await connection.query(
            'UPDATE purchase_batches SET remaining_quantity = remaining_quantity + ? WHERE purchase_id = ? AND product_id = ?',
            [ret.quantity, ret.purchase_id, ret.product_id]
          );
        } else {
          await connection.query(
            'UPDATE purchase_batches SET remaining_quantity = remaining_quantity + ? WHERE product_id = ? ORDER BY id DESC LIMIT 1',
            [ret.quantity, ret.product_id]
          );
        }
      } catch (pbErr) {}

      // Log stock reversal
      await connection.query(
        `INSERT INTO stock_logs (product_id, warehouse_id, vendor_id, type, quantity, reference_no, notes, user_id)
         VALUES (?, ?, ?, 'Stock In', ?, ?, ?, ?)`,
        [
          ret.product_id,
          ret.warehouse_id,
          ret.vendor_id,
          ret.quantity,
          `VOID-${ret.return_no}`,
          `Voided Supplier Return: ${ret.reason}`,
          req.user.id || null
        ]
      );
    }

    // Mark ALL items under this return_no as Void
    await connection.query('UPDATE purchase_returns SET status = "Void" WHERE return_no = ?', [returnNo]);

    // Recalculate vendor financial balance (Single Source of Truth)
    const [invSumSync] = await connection.query('SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE vendor_id = ? AND payment_status != "Void"', [Number(vendorId)]);
    const [retSumSync] = await connection.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_returns WHERE vendor_id = ? AND status != "Void"', [Number(vendorId)]);
    const [paySumSync] = await connection.query('SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE vendor_id = ?', [Number(vendorId)]);
    const [vRowSync] = await connection.query('SELECT opening_balance, opening_balance_type FROM vendors WHERE id = ?', [Number(vendorId)]);

    if (vRowSync.length > 0) {
      const grossPSync = Number(invSumSync[0].total || 0);
      const retPSync = Number(retSumSync[0].total || 0);
      const netPSync = Math.max(0, grossPSync - retPSync);
      const openBSync = vRowSync[0].opening_balance_type === 'Advance' ? -Number(vRowSync[0].opening_balance || 0) : Number(vRowSync[0].opening_balance || 0);
      const totPaidSync = Number(paySumSync[0].total || 0);

      const diffSync = (netPSync + openBSync) - totPaidSync;
      const newOut = diffSync > 0.005 ? Number(diffSync.toFixed(2)) : 0;
      const newAdv = diffSync < -0.005 ? Number(Math.abs(diffSync).toFixed(2)) : 0;

      await connection.query(
        'UPDATE vendors SET total_purchases = ?, total_paid = ?, outstanding_balance = ?, advance_balance = ? WHERE id = ?',
        [grossPSync, totPaidSync, newOut, newAdv, Number(vendorId)]
      );
    }

    await connection.commit();
    log('deleteVendorReturn', `Entire return note ${returnNo} voided successfully`);

    return res.status(200).json({
      success: true,
      message: `Return note ${returnNo} voided. Stock restored for all items and supplier balance updated.`
    });

  } catch (error) {
    errLog('deleteVendorReturn', 'Error voiding return note — rolling back', error);
    try { await connection.rollback(); } catch (_) {}
    next(error);
  } finally {
    try { connection.release(); } catch (_) {}
  }
};
