/**
 * FIFO Queue Helper for Inventory Management
 * Synchronizes the FIFO Queue (purchase_batches) and Product Master (Purchase Price, MRP & Expiry Date)
 * for a given product ID.
 *
 * In FIFO:
 * - The oldest active batch (First In) determines the active purchase_price, selling_price, and MRP on the product master.
 * - When items are consumed or sold, oldest batches are exhausted first.
 * - As older batches exhaust, active purchase_price rolls forward to the succeeding active batch.
 */
export const syncProductFifoState = async (connection, productId) => {
  if (!productId) return;
  try {
    // 1. Get total actual stock from stock table across all warehouses
    const [[stockSum]] = await connection.query(
      'SELECT COALESCE(SUM(quantity), 0) as totalStock FROM stock WHERE product_id = ?',
      [productId]
    );
    const totalStock = Number(stockSum?.totalStock || 0);

    // 2. Reconcile purchase_batches remaining_quantity with actual totalStock if needed
    const [[batchSumRow]] = await connection.query(
      'SELECT COALESCE(SUM(remaining_quantity), 0) as batchSum FROM purchase_batches WHERE product_id = ?',
      [productId]
    );
    const batchSum = Number(batchSumRow?.batchSum || 0);

    if (totalStock <= 0) {
      // If total stock is 0 or negative, mark all purchase_batches as exhausted
      await connection.query(
        'UPDATE purchase_batches SET remaining_quantity = 0 WHERE product_id = ?',
        [productId]
      );
    } else if (Math.abs(totalStock - batchSum) > 0.001) {
      // FIFO Reconciliation:
      // If actual stock is less than batch sum, deduct excess from the oldest active batches first (FIFO order).
      // If actual stock is greater, allocate surplus to the newest batch.
      if (totalStock < batchSum) {
        let excessToDeduct = batchSum - totalStock;
        const [batches] = await connection.query(
          `SELECT id, remaining_quantity FROM purchase_batches 
           WHERE product_id = ? AND remaining_quantity > 0 
           ORDER BY purchase_date ASC, id ASC`,
          [productId]
        );
        for (const b of batches) {
          if (excessToDeduct <= 0) break;
          const rem = Number(b.remaining_quantity || 0);
          const deduct = Math.min(rem, excessToDeduct);
          await connection.query('UPDATE purchase_batches SET remaining_quantity = ? WHERE id = ?', [rem - deduct, b.id]);
          excessToDeduct -= deduct;
        }
      } else {
        let surplusToAdd = totalStock - batchSum;
        const [batches] = await connection.query(
          `SELECT id, remaining_quantity, purchase_quantity FROM purchase_batches 
           WHERE product_id = ? 
           ORDER BY purchase_date DESC, id DESC`,
          [productId]
        );
        if (batches.length > 0) {
          await connection.query(
            'UPDATE purchase_batches SET remaining_quantity = remaining_quantity + ? WHERE id = ?',
            [surplusToAdd, batches[0].id]
          );
        }
      }
    }

    // 3. Find FRONT NODE of FIFO queue (oldest active batch with remaining_quantity > 0)
    const [activeBatches] = await connection.query(
      `SELECT id, batch_number, expiry_date, mrp, selling_price, purchase_price, remaining_quantity
       FROM purchase_batches
       WHERE product_id = ? AND remaining_quantity > 0
       ORDER BY purchase_date ASC, id ASC
       LIMIT 1`,
      [productId]
    );

    if (activeBatches.length > 0) {
      const frontNode = activeBatches[0];
      const newMrp = Number(frontNode.mrp || 0);
      const newSellingPrice = Number(frontNode.selling_price || 0);
      const newExpiry = frontNode.expiry_date || null;
      const newPurchasePrice = Number(frontNode.purchase_price || 0);

      const updateFields = [];
      const queryParams = [];

      if (newPurchasePrice > 0) {
        updateFields.push('purchase_price = ?');
        queryParams.push(newPurchasePrice);
      }
      if (newMrp > 0) {
        updateFields.push('mrp = ?');
        queryParams.push(newMrp);
      }
      if (newSellingPrice > 0) {
        updateFields.push('selling_price = ?');
        queryParams.push(newSellingPrice);
      }
      if (newExpiry && newExpiry !== '0000-00-00' && newExpiry !== 'N/A') {
        updateFields.push('expiry_date = ?');
        queryParams.push(newExpiry);
      }

      // Also sync GST from latest Purchase Order if available
      try {
        const [latestPo] = await connection.query(
          `SELECT gst FROM purchase_order_items WHERE product_id = ? AND gst IS NOT NULL AND gst >= 0 ORDER BY id DESC LIMIT 1`,
          [productId]
        );
        if (latestPo.length > 0 && latestPo[0].gst !== null && !isNaN(Number(latestPo[0].gst))) {
          updateFields.push('gst = ?');
          queryParams.push(Number(latestPo[0].gst));
        }
      } catch (gstErr) {
        // Safe fallback if purchase_order_items doesn't exist
      }

      if (updateFields.length > 0) {
        queryParams.push(productId);
        await connection.query(
          `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`,
          queryParams
        );
      }
    } else {
      // Fallback: If no active batches remain in purchase_batches, check latest purchase_items, grn_items, or purchase_order_items
      const [latestGrn] = await connection.query(
        `SELECT mrp, selling_price, expiry_date FROM grn_items WHERE product_id = ? AND (mrp > 0 OR selling_price > 0) ORDER BY id DESC LIMIT 1`,
        [productId]
      );
      if (latestGrn.length > 0) {
        const fallbackMrp = Number(latestGrn[0].mrp || 0);
        const fallbackSp = Number(latestGrn[0].selling_price || 0);
        const fallbackExp = latestGrn[0].expiry_date;
        if (fallbackMrp > 0) {
          await connection.query('UPDATE products SET mrp = ? WHERE id = ?', [fallbackMrp, productId]);
        }
        if (fallbackSp > 0) {
          await connection.query('UPDATE products SET selling_price = ? WHERE id = ?', [fallbackSp, productId]);
        }
        if (fallbackExp && fallbackExp !== '0000-00-00' && fallbackExp !== 'N/A') {
          await connection.query('UPDATE products SET expiry_date = ? WHERE id = ?', [fallbackExp, productId]);
        }
      }

      const [latestPurchaseItem] = await connection.query(
        `SELECT purchase_price, gst FROM purchase_items WHERE product_id = ? AND purchase_price > 0 ORDER BY id DESC LIMIT 1`,
        [productId]
      );
      if (latestPurchaseItem.length > 0 && Number(latestPurchaseItem[0].purchase_price) > 0) {
        await connection.query('UPDATE products SET purchase_price = ? WHERE id = ?', [Number(latestPurchaseItem[0].purchase_price), productId]);
        if (latestPurchaseItem[0].gst !== null && !isNaN(Number(latestPurchaseItem[0].gst))) {
          await connection.query('UPDATE products SET gst = ? WHERE id = ?', [Number(latestPurchaseItem[0].gst), productId]);
        }
      } else {
        const [latestPoItem] = await connection.query(
          `SELECT purchase_price, gst FROM purchase_order_items WHERE product_id = ? AND purchase_price > 0 ORDER BY id DESC LIMIT 1`,
          [productId]
        );
        if (latestPoItem.length > 0) {
          if (Number(latestPoItem[0].purchase_price) > 0) {
            await connection.query('UPDATE products SET purchase_price = ? WHERE id = ?', [Number(latestPoItem[0].purchase_price), productId]);
          }
          if (latestPoItem[0].gst !== null && !isNaN(Number(latestPoItem[0].gst))) {
            await connection.query('UPDATE products SET gst = ? WHERE id = ?', [Number(latestPoItem[0].gst), productId]);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[FIFO Queue Sync Error for product ${productId}]:`, err.message);
  }
};

// Backwards compatibility alias
export const syncProductLifoState = syncProductFifoState;
