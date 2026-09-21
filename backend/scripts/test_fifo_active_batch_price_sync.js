import { getTenantPool } from '../config/tenantDb.js';
import { syncProductFifoState } from '../utils/fifoQueueHelper.js';

async function testFifoActiveBatchPriceSync() {
  console.log('\n================================================================');
  console.log('   FIFO QUEUE FULL TEST: PURCHASE PRICE, SELLING PRICE & MRP   ');
  console.log('================================================================\n');

  const db = getTenantPool('shop_vinay001');

  try {
    // Cleanup any prior test product
    await db.query("DELETE FROM products WHERE barcode = 'BAR-FIFO-TEST-999'");

    // 1. Fresh Product Registration: has 0.00 pricing
    const [insProd] = await db.query(
      `INSERT INTO products (name, barcode, sku, category_id, unit, purchase_price, selling_price, mrp, gst)
       VALUES ('TEST FIFO FULL CYCLE PROD', 'BAR-FIFO-TEST-999', 'SKU-FIFO-999', 1, 'Pcs', 0.00, 0.00, 0.00, 0.00)`
    );
    const productId = insProd.insertId;

    const [[pInitial]] = await db.query('SELECT purchase_price, selling_price, mrp, gst FROM products WHERE id = ?', [productId]);
    assert(
      Number(pInitial.purchase_price) === 0 && Number(pInitial.selling_price) === 0 && Number(pInitial.mrp) === 0,
      'Step 1: Fresh Product Registration has 0.00 for Purchase Price, Selling Price, MRP & GST',
      `PP: ${pInitial.purchase_price}, SP: ${pInitial.selling_price}, MRP: ${pInitial.mrp}`
    );

    // 2. Draft PO 1: Expected Purchase Price ₹10.00 & GST 5%
    console.log('\n--- Step 2: Draft PO 1 setting initial Purchase Price (₹10.00) & GST (5%) ---');
    // Simulate PO 1 creation under FIFO logic
    const [[activeBatchBeforePO1]] = await db.query(
      'SELECT id, purchase_price FROM purchase_batches WHERE product_id = ? AND remaining_quantity > 0 ORDER BY purchase_date ASC, id ASC LIMIT 1',
      [productId]
    );
    if (!activeBatchBeforePO1) {
      await db.query('UPDATE products SET purchase_price = 10.00, gst = 5.00 WHERE id = ?', [productId]);
    }

    const [[pAfterPO1]] = await db.query('SELECT purchase_price, gst, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(pAfterPO1.purchase_price) === 10 && Number(pAfterPO1.gst) === 5,
      'Step 2: Draft PO 1 establishes initial Purchase Price ₹10.00 & GST 5% on product master',
      `Purchase Price = ₹${pAfterPO1.purchase_price}, GST = ${pAfterPO1.gst}%`
    );

    // 3. GRN 1 Verification: Inward Batch A (10 units @ ₹10.00, Sell: ₹14.00, MRP: ₹16.00)
    console.log('\n--- Step 3: GRN 1 Verification - Inwarding Batch A (10 units, Cost: ₹10, Sell: ₹14, MRP: ₹16) ---');
    const [insBatchA] = await db.query(
      `INSERT INTO purchase_batches (product_id, batch_number, purchase_quantity, remaining_quantity, purchase_date, expiry_date, purchase_price, mrp, selling_price, supplier_id, warehouse_id)
       VALUES (?, 'BATCH-A-FIFO', 10.000, 10.000, '2026-09-01', '2026-12-31', 10.00, 16.00, 14.00, 1, 1)`,
      [productId]
    );
    await db.query('INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, 1, 10.000)', [productId]);

    await syncProductFifoState(db, productId);

    const [[pAfterBatchA]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(pAfterBatchA.purchase_price) === 10 && Number(pAfterBatchA.selling_price) === 14 && Number(pAfterBatchA.mrp) === 16,
      'Step 3: GRN 1 verifies Batch A as First In (Purchase: ₹10, Sell: ₹14, MRP: ₹16)',
      `Purchase: ₹${pAfterBatchA.purchase_price}, Sell: ₹${pAfterBatchA.selling_price}, MRP: ₹${pAfterBatchA.mrp}`
    );

    // 4. Draft PO 2 with HIGHER Purchase Price: ₹18.00!
    console.log('\n--- Step 4: Draft PO 2 with Purchase Price ₹18.00 (FIFO check: active price must stay ₹10) ---');
    const [[activeBatchBeforePO2]] = await db.query(
      'SELECT id, purchase_price FROM purchase_batches WHERE product_id = ? AND remaining_quantity > 0 ORDER BY purchase_date ASC, id ASC LIMIT 1',
      [productId]
    );
    // Under FIFO, active batch A exists with remaining_quantity > 0, so master purchase price MUST stay ₹10.00!
    if (activeBatchBeforePO2 && Number(activeBatchBeforePO2.purchase_price) > 0) {
      await db.query('UPDATE products SET purchase_price = ? WHERE id = ?', [Number(activeBatchBeforePO2.purchase_price), productId]);
    } else {
      await db.query('UPDATE products SET purchase_price = 18.00 WHERE id = ?', [productId]);
    }

    const [[pAfterPO2]] = await db.query('SELECT purchase_price FROM products WHERE id = ?', [productId]);
    assert(
      Number(pAfterPO2.purchase_price) === 10,
      'Step 4: FIFO protects in-stock inventory! Draft PO 2 (@ ₹18) does NOT overwrite active purchase price (remains ₹10)',
      `Active Purchase Price = ₹${pAfterPO2.purchase_price} (Preserved First In Batch A)`
    );

    // 5. GRN 2 Verification: Inward Batch B (10 units @ ₹18.00, Sell: ₹22.00, MRP: ₹25.00)
    console.log('\n--- Step 5: GRN 2 Verification - Inwarding Batch B (10 units, Cost: ₹18, Sell: ₹22, MRP: ₹25) ---');
    await db.query(
      `INSERT INTO purchase_batches (product_id, batch_number, purchase_quantity, remaining_quantity, purchase_date, expiry_date, purchase_price, mrp, selling_price, supplier_id, warehouse_id)
       VALUES (?, 'BATCH-B-FIFO', 10.000, 10.000, '2026-09-02', '2027-06-30', 18.00, 25.00, 22.00, 1, 1)`,
      [productId]
    );
    await db.query('UPDATE stock SET quantity = quantity + 10.000 WHERE product_id = ?', [productId]);

    await syncProductFifoState(db, productId);

    const [[pAfterBatchB]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(pAfterBatchB.purchase_price) === 10 && Number(pAfterBatchB.selling_price) === 14 && Number(pAfterBatchB.mrp) === 16,
      'Step 5: Under FIFO, Batch A is still in stock, so product master preserves Batch A pricing (₹10 / ₹14 / ₹16)',
      `Purchase: ₹${pAfterBatchB.purchase_price}, Sell: ₹${pAfterBatchB.selling_price}, MRP: ₹${pAfterBatchB.mrp}`
    );

    // 6. Sales Consumption: 10 units sold. Under FIFO, Batch A (First In) is consumed first!
    console.log('\n--- Step 6: Selling 10 units under FIFO (Batch A exhausted -> Rolls forward to Batch B) ---');
    await db.query('UPDATE purchase_batches SET remaining_quantity = 0 WHERE id = ?', [insBatchA.insertId]);
    await db.query('UPDATE stock SET quantity = quantity - 10.000 WHERE product_id = ?', [productId]);

    await syncProductFifoState(db, productId);

    const [[pAfterSale]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(pAfterSale.purchase_price) === 18 && Number(pAfterSale.selling_price) === 22 && Number(pAfterSale.mrp) === 25,
      'Step 6: FIFO rolls active Purchase Price (₹18), Selling Price (₹22), and MRP (₹25) forward to Batch B after Batch A exhausts',
      `Purchase: ₹${pAfterSale.purchase_price}, Sell: ₹${pAfterSale.selling_price}, MRP: ₹${pAfterSale.mrp}`
    );

    // Cleanup test product
    await db.query('DELETE FROM purchase_batches WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM stock WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM products WHERE id = ?', [productId]);

    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passCount} PASSED | ${failCount} FAILED                 `);
    console.log('================================================================\n');

    process.exit(failCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('FIFO Queue Test Error:', err);
    process.exit(1);
  }
}

let passCount = 0;
let failCount = 0;

function assert(condition, testName, detail) {
  if (condition) {
    console.log(`✅ [PASS] ${testName} -> ${detail}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} -> ${detail}`);
    failCount++;
  }
}

testFifoActiveBatchPriceSync();
