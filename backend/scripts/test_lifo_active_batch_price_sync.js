import mysql from 'mysql2/promise';
import { syncProductLifoState } from '../utils/fifoQueueHelper.js';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'shop_aman001'
};

async function testLifoActiveBatchPriceSync() {
  console.log('================================================================');
  console.log('   LIFO QUEUE FULL TEST: PURCHASE PRICE, SELLING PRICE & MRP   ');
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
    // 1. Create dedicated clean test product without any initial pricing (as registered from new form)
    const [createProd] = await db.query(
      `INSERT INTO products (name, barcode, sku, category_id, unit, purchase_price, selling_price, mrp, gst)
       VALUES ('TEST LIFO FULL CYCLE PROD', 'BAR-LIFO-TEST-999', 'SKU-LIFO-999', 1, 'Pcs', 0.00, 0.00, 0.00, 0.00)`
    );
    const productId = createProd.insertId;

    // Verify initial registration state has 0 for all pricing fields
    const [[initialProd]] = await db.query('SELECT purchase_price, selling_price, mrp, gst FROM products WHERE id = ?', [productId]);
    assert(
      Number(initialProd.purchase_price) === 0 &&
      Number(initialProd.selling_price) === 0 &&
      Number(initialProd.mrp) === 0 &&
      Number(initialProd.gst) === 0,
      'Step 1: Fresh Product Registration has 0.00 for Purchase Price, Selling Price, MRP & GST'
    );

    // 2. Simulate Draft PO Request setting Purchase Price = ₹8.00 and GST = 5%
    console.log('\n--- Step 2: Setting Purchase Price (₹8.00) & GST (5%) via Draft PO Request ---');
    await db.query('UPDATE products SET purchase_price = 8.00, gst = 5.00 WHERE id = ?', [productId]);
    const [[prodAfterPO]] = await db.query('SELECT purchase_price, gst, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(prodAfterPO.purchase_price) === 8.00 &&
      Number(prodAfterPO.gst) === 5.00 &&
      Number(prodAfterPO.selling_price) === 0 &&
      Number(prodAfterPO.mrp) === 0,
      'Step 2: Draft PO sets Purchase Price ₹8.00 & GST 5% on product master (Selling & MRP remain unverified)',
      `Purchase Price = ₹${prodAfterPO.purchase_price}, GST = ${prodAfterPO.gst}%`
    );

    // 3. GRN Verification 1: Receive Batch A (10 units @ purchase ₹8.00, selling ₹12.00, MRP ₹15.00)
    console.log('\n--- Step 3: GRN Verification - Receiving Batch A (10 units, Sell: ₹12.00, MRP: ₹15.00) ---');
    await db.query('INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, 1, 10)', [productId]);
    
    // Save to grn_items
    await db.query(
      `INSERT INTO grn_items (grn_id, product_id, quantity_received, batch_number, mrp, selling_price)
       VALUES (1, ?, 10, 'TEST-BATCH-A', 15.00, 12.00)`,
      [productId]
    );

    // Save to purchase_batches
    await db.query(
      `INSERT INTO purchase_batches (product_id, batch_number, purchase_quantity, remaining_quantity, purchase_date, purchase_price, mrp, selling_price, warehouse_id)
       VALUES (?, 'TEST-BATCH-A', 10, 10, DATE_SUB(NOW(), INTERVAL 2 DAY), 8.00, 15.00, 12.00, 1)`,
      [productId]
    );

    // Run LIFO sync
    await syncProductLifoState(db, productId);
    const [[prodAfterGRN1]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(prodAfterGRN1.purchase_price) === 8.00 &&
      Number(prodAfterGRN1.selling_price) === 12.00 &&
      Number(prodAfterGRN1.mrp) === 15.00,
      'Step 3: GRN 1 sets concrete Selling Price ₹12.00 & MRP ₹15.00 on product master (Batch A active)',
      `Purchase: ₹${prodAfterGRN1.purchase_price}, Sell: ₹${prodAfterGRN1.selling_price}, MRP: ₹${prodAfterGRN1.mrp}`
    );

    // 4. GRN Verification 2 [LAST IN]: Receive Batch B (10 units @ purchase ₹10.00, selling ₹16.00, MRP ₹20.00)
    console.log('\n--- Step 4: GRN Verification - Receiving Batch B [LAST IN] (10 units, Sell: ₹16.00, MRP: ₹20.00) ---');
    await db.query('UPDATE stock SET quantity = 20 WHERE product_id = ?', [productId]);
    
    // Save to grn_items
    await db.query(
      `INSERT INTO grn_items (grn_id, product_id, quantity_received, batch_number, mrp, selling_price)
       VALUES (1, ?, 10, 'TEST-BATCH-B', 20.00, 16.00)`,
      [productId]
    );

    // Save to purchase_batches (newer purchase_date)
    await db.query(
      `INSERT INTO purchase_batches (product_id, batch_number, purchase_quantity, remaining_quantity, purchase_date, purchase_price, mrp, selling_price, warehouse_id)
       VALUES (?, 'TEST-BATCH-B', 10, 10, DATE_SUB(NOW(), INTERVAL 1 DAY), 10.00, 20.00, 16.00, 1)`,
      [productId]
    );

    // Run LIFO sync
    await syncProductLifoState(db, productId);
    const [[prodAfterGRN2]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(prodAfterGRN2.purchase_price) === 10.00 &&
      Number(prodAfterGRN2.selling_price) === 16.00 &&
      Number(prodAfterGRN2.mrp) === 20.00,
      'Step 4: LIFO updates product master immediately to newest Batch B (Purchase: ₹10, Sell: ₹16, MRP: ₹20)',
      `Purchase: ₹${prodAfterGRN2.purchase_price}, Sell: ₹${prodAfterGRN2.selling_price}, MRP: ₹${prodAfterGRN2.mrp}`
    );

    // 5. Sales Deduction under LIFO: 10 units sold. Batch B (Last In) is consumed first!
    console.log('\n--- Step 5: Selling 10 units under LIFO (Batch B consumed first) ---');
    await db.query('UPDATE stock SET quantity = 10 WHERE product_id = ?', [productId]);
    await db.query('UPDATE purchase_batches SET remaining_quantity = 0 WHERE batch_number = "TEST-BATCH-B" AND product_id = ?', [productId]);

    // Run LIFO sync after Batch B exhausted
    await syncProductLifoState(db, productId);
    const [[prodAfterBSold]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      Number(prodAfterBSold.purchase_price) === 8.00 &&
      Number(prodAfterBSold.selling_price) === 12.00 &&
      Number(prodAfterBSold.mrp) === 15.00,
      'Step 5: LIFO automatically rolls back active Selling Price (₹12), MRP (₹15), and Purchase Price (₹8) to Batch A after Batch B exhausts',
      `Purchase: ₹${prodAfterBSold.purchase_price}, Sell: ₹${prodAfterBSold.selling_price}, MRP: ₹${prodAfterBSold.mrp}`
    );

    // 6. Verify non-dynamic concrete persistence
    console.log('\n--- Step 6: Non-dynamic check (concrete table values) ---');
    const [[directProd]] = await db.query('SELECT purchase_price, selling_price, mrp FROM products WHERE id = ?', [productId]);
    assert(
      directProd.purchase_price !== null && directProd.selling_price !== null && directProd.mrp !== null,
      'Step 6: Concrete persistence verified (values exist directly on `products` table, not dynamically computed)',
      `Stored directly in row: [purchase_price: ${directProd.purchase_price}, selling_price: ${directProd.selling_price}, mrp: ${directProd.mrp}]`
    );

    // Cleanup test records
    await db.query('DELETE FROM purchase_batches WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM grn_items WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM stock WHERE product_id = ?', [productId]);
    await db.query('DELETE FROM products WHERE id = ?', [productId]);

    console.log('\n================================================================');
    console.log(`   TEST RESULTS: ${passed} PASSED | ${failed} FAILED                 `);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('LIFO Queue Test Error:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

testLifoActiveBatchPriceSync();
