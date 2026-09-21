import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'shop_aman001'
};

async function testGrnDamagedDeductionAndStock() {
  console.log('================================================================');
  console.log('   GRN DAMAGED STOCK EXCLUSION & SUPPLIER BILLING DEDUCTION TEST');
  console.log('================================================================\n');

  const db = await mysql.createConnection(dbConfig);
  let passed = 0;
  let failed = 0;

  function assert(cond, name, info = '') {
    if (cond) {
      console.log(`✅ [PASS] ${name} ${info ? '-> ' + info : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${info ? '-> ' + info : ''}`);
      failed++;
    }
  }

  try {
    // 1. Create a test vendor
    const [vendRes] = await db.query(
      `INSERT INTO vendors (name, phone, email, status, opening_balance, opening_balance_type, total_purchases, total_paid, outstanding_balance)
       VALUES ('TEST VENDOR DAMAGED', '9999988888', 'testvend@example.com', 'Active', 0.00, 'Payable', 0.00, 0.00, 0.00)`
    );
    const vendorId = vendRes.insertId;

    // 2. Create clean test product (Unit Cost = ₹100, GST = 5%)
    const [prodRes] = await db.query(
      `INSERT INTO products (name, barcode, sku, category_id, unit, purchase_price, selling_price, mrp, gst)
       VALUES ('TEST DAMAGED DEDUCTION PROD', 'BAR-DAM-001', 'SKU-DAM-001', 1, 'Pcs', 100.00, 150.00, 150.00, 5.00)`
    );
    const productId = prodRes.insertId;

    // 3. Create PO for 5 units (5 * 100 + 5% = ₹525.00)
    const poNo = `PO-TEST-DAM-${Date.now()}`;
    const [poRes] = await db.query(
      `INSERT INTO purchase_orders (purchase_order_no, vendor_id, warehouse_id, date, subtotal, gst_amount, total, status)
       VALUES (?, ?, 1, NOW(), 500.00, 25.00, 525.00, 'Confirmed')`,
      [poNo, vendorId]
    );
    const poId = poRes.insertId;

    await db.query(
      `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, received_quantity, purchase_price, gst, total)
       VALUES (?, ?, 5, 0, 100.00, 5.00, 525.00)`,
      [poId, productId]
    );

    console.log(`--- Step 1: Created PO #${poNo} for 5 units @ ₹100 + 5% GST = ₹525.00 ---`);

    // 4. Simulate GRN: Ordered 5, Received 5, Damaged 4! (Net Accepted = 1)
    console.log('\n--- Step 2: Processing GRN (Received 5, Damaged 4) ---');
    const grnNo = `GRN-TEST-DAM-${Date.now()}`;
    const [grnRes] = await db.query(
      `INSERT INTO grns (grn_no, purchase_order_id, vendor_id, warehouse_id, date, notes)
       VALUES (?, ?, ?, 1, NOW(), 'Test GRN with 4 damaged units')`,
      [grnNo, poId, vendorId]
    );
    const grnId = grnRes.insertId;

    const qtyRec = 5;
    const qtyDam = 4;
    const netAcceptedQty = Math.max(0, qtyRec - qtyDam); // 1 unit

    // Save grn_items
    await db.query(
      `INSERT INTO grn_items (grn_id, product_id, quantity_received, quantity_damaged, quantity_rejected, batch_number, mrp, selling_price)
       VALUES (?, ?, ?, ?, 0, 'BATCH-DAM-TEST', 150.00, 140.00)`,
      [grnId, productId, qtyRec, qtyDam]
    );

    // Update PO items with Net Accepted Quantity (1)
    await db.query(
      `UPDATE purchase_order_items SET received_quantity = received_quantity + ? WHERE purchase_order_id = ? AND product_id = ?`,
      [netAcceptedQty, poId, productId]
    );

    // Stock & Batches: ONLY Net Accepted Quantity (1 unit) is added!
    await db.query(
      `INSERT INTO purchase_batches (product_id, batch_number, purchase_quantity, remaining_quantity, purchase_date, purchase_price, mrp, selling_price, supplier_id, warehouse_id, grn_id)
       VALUES (?, 'BATCH-DAM-TEST', ?, ?, NOW(), 100.00, 150.00, 140.00, ?, 1, ?)`,
      [productId, netAcceptedQty, netAcceptedQty, vendorId, grnId]
    );

    await db.query(
      `INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, 1, ?)`,
      [productId, netAcceptedQty]
    );

    // Financial calculations on Net Accepted Quantity:
    const acceptedSubtotal = Number((netAcceptedQty * 100.00).toFixed(2)); // 100.00
    const acceptedGst = Number(((acceptedSubtotal * 5) / 100).toFixed(2)); // 5.00
    const acceptedTotal = Number((acceptedSubtotal + acceptedGst).toFixed(2)); // 105.00

    // Create Purchase Invoice for Net Accepted Amount:
    const purNo = `PUR-TEST-DAM-${Date.now()}`;
    const [purRes] = await db.query(
      `INSERT INTO purchases (purchase_no, vendor_id, warehouse_id, date, subtotal, discount, gst_amount, total, paid_amount, payment_status, delivery_status, payment_method, purchase_order_id, grn_id)
       VALUES (?, ?, 1, NOW(), ?, 0.00, ?, ?, 0.00, 'Pending', 'Received', 'Credit', ?, ?)`,
      [purNo, vendorId, acceptedSubtotal, acceptedGst, acceptedTotal, poId, grnId]
    );
    const purchaseId = purRes.insertId;

    await db.query(
      `INSERT INTO purchase_items (purchase_id, product_id, quantity, purchase_price, mrp, gst, total)
       VALUES (?, ?, ?, 100.00, 150.00, 5.00, ?)`,
      [purchaseId, productId, netAcceptedQty, acceptedTotal]
    );

    // Update Vendor Ledger for Net Accepted Amount (₹105.00)
    await db.query(
      `UPDATE vendors SET total_purchases = ?, outstanding_balance = ? WHERE id = ?`,
      [acceptedTotal, acceptedTotal, vendorId]
    );
    await db.query(
      `INSERT INTO vendor_ledger (vendor_id, purchase_id, date, transaction_type, reference_no, description, debit_amount, credit_amount, running_balance)
       VALUES (?, ?, NOW(), 'PURCHASE_INVOICE', ?, 'Purchase Invoice Net Accepted', ?, 0.00, ?)`,
      [vendorId, purchaseId, purNo, acceptedTotal, acceptedTotal]
    );

    // Update PO Status
    const [[updatedPoi]] = await db.query('SELECT quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
    const poStatus = updatedPoi.received_quantity >= updatedPoi.quantity ? 'Completed' : 'Partially Received';
    await db.query('UPDATE purchase_orders SET status = ? WHERE id = ?', [poStatus, poId]);

    console.log('\n--- Step 3: Verifying Results ---');

    // 1. Check Stock: Must be exactly 1 (4 damaged units excluded)
    const [[stockRow]] = await db.query('SELECT quantity FROM stock WHERE product_id = ?', [productId]);
    assert(Number(stockRow.quantity) === 1, 'Test 1: Stock contains ONLY accepted quantity (1 unit)', `Stock = ${stockRow.quantity}`);

    // 2. Check Purchase Batch: Must have quantity = 1, remaining = 1
    const [[batchRow]] = await db.query('SELECT purchase_quantity, remaining_quantity FROM purchase_batches WHERE product_id = ?', [productId]);
    assert(
      Number(batchRow.purchase_quantity) === 1 && Number(batchRow.remaining_quantity) === 1,
      'Test 2: Purchase batch contains ONLY accepted quantity (1 unit)',
      `Batch Purchase Qty = ${batchRow.purchase_quantity}, Remaining = ${batchRow.remaining_quantity}`
    );

    // 3. Check Purchase Invoice: Must be ₹105.00 (NOT ₹525.00)
    const [[purRow]] = await db.query('SELECT subtotal, gst_amount, total FROM purchases WHERE id = ?', [purchaseId]);
    assert(
      Number(purRow.total) === 105.00,
      'Test 3: Purchase Invoice amount is based ONLY on accepted goods (₹105.00)',
      `Invoice Total = ₹${purRow.total}`
    );

    // 4. Check Damaged Deduction: ₹420.00 deducted from PO total
    const damagedDeduction = 525.00 - Number(purRow.total);
    assert(
      damagedDeduction === 420.00,
      'Test 4: Damaged units cost (4 * ₹105 = ₹420.00) successfully deducted from bill',
      `Deduction = ₹${damagedDeduction}`
    );

    // 5. Check Vendor Ledger & Balance: Must reflect ₹105.00
    const [[ledgerRow]] = await db.query('SELECT debit_amount FROM vendor_ledger WHERE purchase_id = ?', [purchaseId]);
    const [[vendRow]] = await db.query('SELECT total_purchases, outstanding_balance FROM vendors WHERE id = ?', [vendorId]);
    assert(
      Number(ledgerRow.debit_amount) === 105.00 && Number(vendRow.outstanding_balance) === 105.00,
      'Test 5: Vendor Ledger & Outstanding balance credited with ONLY net payable (₹105.00)',
      `Ledger Debit = ₹${ledgerRow.debit_amount}, Vendor Balance = ₹${vendRow.outstanding_balance}`
    );

    // 6. Check PO Status: Must be 'Partially Received' (4 still remaining)
    const [[poFinal]] = await db.query('SELECT status FROM purchase_orders WHERE id = ?', [poId]);
    assert(
      poFinal.status === 'Partially Received',
      'Test 6: PO status is Partially Received because 4 damaged units were rejected',
      `Status = ${poFinal.status}`
    );

    // Cleanup
    await db.query('DELETE FROM vendor_ledger WHERE vendor_id = ?', [vendorId]);
    await db.query('DELETE FROM purchase_items WHERE purchase_id = ?', [purchaseId]);
    await db.query('DELETE FROM purchases WHERE id = ?', [purchaseId]);
    await db.query('DELETE FROM purchase_batches WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM stock WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM grn_items WHERE grn_id = ?', [grnId]);
    await db.query('DELETE FROM grns WHERE id = ?', [grnId]);
    await db.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
    await db.query('DELETE FROM purchase_orders WHERE id = ?', [poId]);
    await db.query('DELETE FROM products WHERE id = ?', [productId]);
    await db.query('DELETE FROM vendors WHERE id = ?', [vendorId]);

    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED | ${failed} FAILED                 `);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

testGrnDamagedDeductionAndStock();