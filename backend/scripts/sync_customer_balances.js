import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const masterPool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'kirana_erp_master',
  waitForConnections: true,
  connectionLimit: 5
});

export const syncCustomerBalancesForDb = async (conn, dbName) => {
  console.log(`\n=== Syncing Customer Balances for [${dbName}] ===`);
  const [customers] = await conn.query('SELECT id, name, advance_balance, outstanding_balance FROM customers WHERE name != "Walk-in Customer"');

  let updatedCount = 0;
  for (const c of customers) {
    // 1. Calculate remaining dues from borrow_transactions
    const [btRows] = await conn.query(
      `SELECT COALESCE(SUM(remaining_amount), 0) as total_due 
       FROM borrow_transactions 
       WHERE customer_id = ? AND payment_status != 'Paid'`,
      [c.id]
    );
    const totalDue = Number(btRows[0]?.total_due || 0);

    // 2. Calculate net ledger balance from borrow_records
    const [brRows] = await conn.query(
      `SELECT type, COALESCE(SUM(amount), 0) as total_amt
       FROM borrow_records
       WHERE customer_id = ?
       GROUP BY type`,
      [c.id]
    );

    let totalBorrows = 0;
    let totalPaybacks = 0;
    let totalAdvanceDeposits = 0;
    let totalReturns = 0;
    let totalRefunds = 0;
    let totalAdvanceRedemptions = 0;

    for (const row of brRows) {
      const amt = Number(row.total_amt);
      if (row.type === 'Borrow') totalBorrows += amt;
      else if (row.type === 'Payback') totalPaybacks += amt;
      else if (row.type === 'Advance Deposit') totalAdvanceDeposits += amt;
      else if (row.type === 'Return') totalReturns += amt;
      else if (row.type === 'Refund' || row.type === 'Cash Refund') totalRefunds += amt;
      else if (row.type === 'Advance Redemption') totalAdvanceRedemptions += amt;
    }

    const netCredits = (totalPaybacks + totalAdvanceDeposits + totalReturns) - (totalBorrows + totalAdvanceRedemptions + totalRefunds);

    let newAdvance = 0;
    let newOutstanding = 0;

    if (netCredits < 0) {
      newOutstanding = Math.abs(netCredits);
      newAdvance = 0;

      let debtToAllocate = newOutstanding;
      const [txs] = await conn.query(
        `SELECT id, total_amount, paid_amount, remaining_amount, due_date 
         FROM borrow_transactions 
         WHERE customer_id = ? 
         ORDER BY borrow_date DESC, id DESC`,
        [c.id]
      );

      const now = new Date();
      for (const tx of txs) {
        const txTotal = Number(tx.total_amount);
        if (debtToAllocate <= 0) {
          await conn.query(
            `UPDATE borrow_transactions 
             SET remaining_amount = 0, paid_amount = total_amount, payment_status = 'Paid' 
             WHERE id = ?`,
            [tx.id]
          );
        } else if (debtToAllocate >= txTotal) {
          await conn.query(
            `UPDATE borrow_transactions 
             SET remaining_amount = total_amount, paid_amount = 0, payment_status = 'Pending' 
             WHERE id = ?`,
            [tx.id]
          );
          debtToAllocate -= txTotal;
        } else {
          const rem = debtToAllocate;
          const pd = txTotal - rem;
          await conn.query(
            `UPDATE borrow_transactions 
             SET remaining_amount = ?, paid_amount = ?, payment_status = 'Partial Paid' 
             WHERE id = ?`,
            [rem, pd, tx.id]
          );
          debtToAllocate = 0;
        }
      }
    } else if (netCredits > 0) {
      newOutstanding = 0;
      newAdvance = netCredits;

      await conn.query(
        `UPDATE borrow_transactions 
         SET remaining_amount = 0, paid_amount = total_amount, payment_status = 'Paid' 
         WHERE customer_id = ? AND payment_status != 'Paid'`,
        [c.id]
      );
    } else {
      newOutstanding = 0;
      newAdvance = 0;

      await conn.query(
        `UPDATE borrow_transactions 
         SET remaining_amount = 0, paid_amount = total_amount, payment_status = 'Paid' 
         WHERE customer_id = ? AND payment_status != 'Paid'`,
        [c.id]
      );
    }

    if (Number(c.advance_balance) !== newAdvance || Number(c.outstanding_balance) !== newOutstanding) {
      console.log(`  Updating customer "${c.name}" (ID: ${c.id}): Due ${c.outstanding_balance} -> ${newOutstanding}, Advance ${c.advance_balance} -> ${newAdvance}`);
      await conn.query(
        'UPDATE customers SET outstanding_balance = ?, advance_balance = ? WHERE id = ?',
        [newOutstanding, newAdvance, c.id]
      );
      updatedCount++;
    }
  }
  console.log(`Completed [${dbName}]: Updated ${updatedCount} / ${customers.length} customer balances.`);
};

const run = async () => {
  try {
    const [databases] = await masterPool.query('SHOW DATABASES');
    const shopDbs = databases.map(d => d.Database).filter(name => name.startsWith('shop_'));

    console.log(`Found ${shopDbs.length} shop databases to process:`, shopDbs);

    for (const dbName of shopDbs) {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: dbName
      });
      await syncCustomerBalancesForDb(conn, dbName);
      await conn.end();
    }
    console.log('\n✅ All customer balances across all databases synced successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
}
