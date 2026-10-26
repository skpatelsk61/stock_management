import db from '../config/db.js';

async function main() {
  try {
    const [vendors] = await db.query('SELECT id, name, opening_balance, opening_balance_type, total_purchases, total_paid, outstanding_balance, advance_balance FROM vendors LIMIT 10');
    console.log('Vendors:', vendors);

    const [purchases] = await db.query('SELECT id, purchase_no, vendor_id, total, paid_amount, payment_status FROM purchases ORDER BY id DESC LIMIT 5');
    console.log('Recent Purchases:', purchases);

    const [payments] = await db.query('SELECT id, payment_no, vendor_id, purchase_id, amount, payment_mode, remarks FROM supplier_payments ORDER BY id DESC LIMIT 5');
    console.log('Recent Supplier Payments:', payments);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
