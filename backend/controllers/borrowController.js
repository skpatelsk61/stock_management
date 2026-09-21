import { logActivity } from '../utils/activityLogger.js';
import { createNotification } from '../services/notificationService.js';

// Helper function to recalculate and synchronize customer outstanding_balance and advance_balance in real time
export const syncCustomerBalances = async (db, customerId) => {
  if (!customerId || Number(customerId) === 1) return; // Skip Walk-in Customer

  // 1. Calculate net ledger balance from borrow_records
  const [brRows] = await db.query(
    `SELECT type, COALESCE(SUM(amount), 0) as total_amt
     FROM borrow_records
     WHERE customer_id = ?
     GROUP BY type`,
    [customerId]
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

  // Net Credits vs Debits
  // Credits (Store owes customer): Paybacks + Advance Deposits + Returns
  // Debits (Customer owes store): Borrows + Advance Redemptions + Refunds
  const netBalance = (totalPaybacks + totalAdvanceDeposits + totalReturns) - (totalBorrows + totalAdvanceRedemptions + totalRefunds);

  let newOutstanding = 0;
  let newAdvance = 0;

  if (netBalance < 0) {
    // Customer has net outstanding dues (Bakaya)
    newOutstanding = Math.abs(netBalance);
    newAdvance = 0;

    // Synchronize borrow_transactions so unpaid invoices accurately match newOutstanding
    let debtToAllocate = newOutstanding;
    const [txs] = await db.query(
      `SELECT id, total_amount, paid_amount, remaining_amount, due_date 
       FROM borrow_transactions 
       WHERE customer_id = ? 
       ORDER BY borrow_date DESC, id DESC`,
      [customerId]
    );

    const now = new Date();
    for (const tx of txs) {
      const txTotal = Number(tx.total_amount);
      if (debtToAllocate <= 0) {
        await db.query(
          `UPDATE borrow_transactions 
           SET remaining_amount = 0, paid_amount = total_amount, payment_status = 'Paid' 
           WHERE id = ?`,
          [tx.id]
        );
      } else if (debtToAllocate >= txTotal) {
        await db.query(
          `UPDATE borrow_transactions 
           SET remaining_amount = total_amount, paid_amount = 0, payment_status = 'Pending' 
           WHERE id = ?`,
          [tx.id]
        );
        debtToAllocate -= txTotal;
      } else {
        const rem = debtToAllocate;
        const pd = txTotal - rem;
        await db.query(
          `UPDATE borrow_transactions 
           SET remaining_amount = ?, paid_amount = ?, payment_status = 'Partial Paid' 
           WHERE id = ?`,
          [rem, pd, tx.id]
        );
        debtToAllocate = 0;
      }
    }
  } else if (netBalance > 0) {
    // Customer has net Advance Credit (Jama)
    newOutstanding = 0;
    newAdvance = netBalance;

    // All borrow_transactions are fully paid / covered by advance
    await db.query(
      `UPDATE borrow_transactions 
       SET remaining_amount = 0, paid_amount = total_amount, payment_status = 'Paid' 
       WHERE customer_id = ? AND payment_status != 'Paid'`,
      [customerId]
    );
  } else {
    // Fully settled / Clear
    newOutstanding = 0;
    newAdvance = 0;

    await db.query(
      `UPDATE borrow_transactions 
       SET remaining_amount = 0, paid_amount = total_amount, payment_status = 'Paid' 
       WHERE customer_id = ? AND payment_status != 'Paid'`,
      [customerId]
    );
  }

  await db.query(
    'UPDATE customers SET outstanding_balance = ?, advance_balance = ? WHERE id = ?',
    [newOutstanding, newAdvance, customerId]
  );
};

// @desc    Get borrow summary by customer (outstanding balances, customer profile details)
// @route   GET /api/borrow
// @access  Private
export const getBorrowSummary = async (req, res, next) => {
  try {
    const { search } = req.query;

    let query = `
      SELECT c.id, c.customer_code, c.name, c.phone, c.email, c.address, c.customer_type, c.status,
             COALESCE(c.advance_balance, 0) as advance_balance,
             COALESCE(c.outstanding_balance, 0) as balance,
             COALESCE(c.outstanding_balance, 0) as outstanding_balance
      FROM customers c
      WHERE (c.customer_type = 'Borrow' OR c.id IN (SELECT DISTINCT customer_id FROM borrow_transactions) OR COALESCE(c.advance_balance, 0) > 0 OR COALESCE(c.outstanding_balance, 0) > 0)
        AND c.name != 'Walk-in Customer'
    `;
    const queryParams = [];

    if (search) {
      query += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.customer_code LIKE ?)';
      const s = `%${search}%`;
      queryParams.push(s, s, s);
    }

    query += ' ORDER BY balance DESC, c.name ASC';

    const [summary] = await req.db.query(query, queryParams);

    const [totals] = await req.db.query(`
      SELECT 
        COALESCE((SELECT SUM(outstanding_balance) FROM customers WHERE name != 'Walk-in Customer'), 0) as total_pending,
        COALESCE((SELECT COUNT(*) FROM customers WHERE name != 'Walk-in Customer' AND outstanding_balance > 0), 0) as total_debtors,
        COALESCE((SELECT SUM(advance_balance) FROM customers WHERE name != 'Walk-in Customer'), 0) as total_advance_credit,
        COALESCE((SELECT COUNT(*) FROM customers WHERE name != 'Walk-in Customer' AND outstanding_balance = 0 AND advance_balance = 0), 0) as total_settled
    `);

    return res.status(200).json({ 
      success: true, 
      count: summary.length, 
      summary,
      summaryTotals: totals[0] || { total_pending: 0, total_debtors: 0, total_advance_credit: 0, total_settled: 0 }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed borrow transactions list
// @route   GET /api/borrow/transactions
// @access  Private
export const getBorrowTransactions = async (req, res, next) => {
  try {
    const { customerId, status } = req.query;

    let query = `
      SELECT bt.*, c.name as customer_name, c.phone as customer_phone, c.customer_code,
             bt.payment_status as current_payment_status
      FROM borrow_transactions bt
      JOIN customers c ON bt.customer_id = c.id
      WHERE c.name != 'Walk-in Customer'
    `;
    const queryParams = [];

    if (customerId) {
      query += ' AND bt.customer_id = ?';
      queryParams.push(customerId);
    }

    if (status && status !== 'all') {
      query += ' AND bt.payment_status = ?';
      queryParams.push(status);
    }

    query += ' ORDER BY bt.borrow_date DESC, bt.created_at DESC';

    const [transactions] = await req.db.query(query, queryParams);
    
    const formattedTransactions = transactions.map(t => ({
      ...t,
      payment_status: t.current_payment_status
    }));

    return res.status(200).json({ success: true, count: formattedTransactions.length, transactions: formattedTransactions });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Udhaar Ledger & Payment History (from borrow_records table)
// @route   GET /api/borrow/history
// @access  Private
export const getBorrowHistory = async (req, res, next) => {
  try {
    const { customerId } = req.query;

    let query = `
      SELECT br.*, c.name as customer_name, c.phone as customer_phone, c.customer_code
      FROM borrow_records br
      JOIN customers c ON br.customer_id = c.id
      WHERE c.name != 'Walk-in Customer'
    `;
    const queryParams = [];

    if (customerId) {
      query += ' AND br.customer_id = ?';
      queryParams.push(customerId);
    }

    query += ' ORDER BY br.date DESC, br.created_at DESC';

    const [history] = await req.db.query(query, queryParams);
    return res.status(200).json({ success: true, count: history.length, history });
  } catch (error) {
    next(error);
  }
};

// @desc    Record a new credit transaction (Borrow Entry)
// @route   POST /api/borrow/transactions
// @access  Private
export const addBorrowTransaction = async (req, res, next) => {
  const connection = await req.db.getConnection();
  try {
    await connection.beginTransaction();

    const { customer_id, invoice_no, total_amount, amount, borrow_date, date, due_date, remarks } = req.body;
    const targetDate = borrow_date || date || new Date().toISOString().split('T')[0];
    const amt = Number(total_amount || amount);

    if (!customer_id || !amt || amt <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Valid customer_id and amount greater than zero required' });
    }

    // Verify customer exists
    const [customer] = await connection.query('SELECT name, customer_type, COALESCE(advance_balance, 0) as advance_balance FROM customers WHERE id = ?', [customer_id]);
    if (customer.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (customer[0].customer_type !== 'Borrow') {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Credit transactions can only be recorded for Borrow Customers.' });
    }

    let finalDueDate = due_date;
    if (!finalDueDate) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() + 15);
      finalDueDate = d.toISOString().split('T')[0];
    }

    const [result] = await connection.query(
      `INSERT INTO borrow_transactions (
        customer_id, invoice_no, borrow_date, due_date, total_amount, paid_amount, remaining_amount, payment_status, remarks, created_by
      ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'Pending', ?, ?)`,
      [customer_id, invoice_no || null, targetDate, finalDueDate, amt, amt, remarks || 'Manual Udhaar Entry', req.user?.id || null]
    );
    const insertId = result.insertId;

    await connection.query(
      'INSERT INTO borrow_records (customer_id, amount, type, date, notes) VALUES (?, ?, ?, ?, ?)',
      [customer_id, amt, 'Borrow', targetDate, remarks || `Manual Udhaar Entry ${invoice_no ? `(${invoice_no})` : ''}`]
    );

    await syncCustomerBalances(connection, customer_id);
    await connection.commit();

    await logActivity(
      req.user.id,
      'Create Borrow Transaction',
      'Borrow',
      `Recorded Udhaar of ₹${amt} for customer "${customer[0].name}"`,
      req.ip
    );

    await createNotification({
      tenantId: req.tenantId,
      user_id: req.user?.id,
      type: 'Customer Credit',
      title: 'Udhaar Credit Issued',
      message: `Udhaar credit of ₹${amt.toLocaleString('en-IN')} issued to "${customer[0].name}".`,
      priority: 'Medium',
      related_user: req.user?.name || req.user?.email || 'Staff',
      module: 'Customer',
      related_module: 'Customer',
      reference_id: insertId,
      reference_type: 'BorrowTransaction',
      target_roles: 'Admin,Manager,Staff'
    });

    const [updatedCust] = await connection.query('SELECT outstanding_balance, advance_balance FROM customers WHERE id = ?', [customer_id]);

    return res.status(201).json({
      success: true,
      message: 'Borrow transaction recorded successfully',
      transactionId: insertId,
      customer: updatedCust[0]
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// @desc    Record a payback payment
// @route   POST /api/borrow/payback
// @access  Private
export const addPaybackPayment = async (req, res, next) => {
  const connection = await req.db.getConnection();
  try {
    await connection.beginTransaction();

    const { customer_id, transaction_id, amount, entry_type, date, remarks } = req.body;

    if (!customer_id || !amount || !date) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Required fields: customer_id, amount, and date' });
    }

    const payAmt = Number(amount);
    if (payAmt <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Transaction amount must be greater than zero' });
    }

    const [customer] = await connection.query('SELECT name FROM customers WHERE id = ?', [customer_id]);
    if (customer.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const typeUpper = String(entry_type || '').toUpperCase().trim();

    if (typeUpper === 'REFUND' || typeUpper === 'ADVANCE REFUND' || typeUpper === 'CASH REFUND') {
      await connection.query(
        'INSERT INTO borrow_records (customer_id, amount, type, date, notes) VALUES (?, ?, ?, ?, ?)',
        [customer_id, payAmt, 'Refund', date, remarks || 'Cash Refund Paid to Customer']
      );

      await syncCustomerBalances(connection, customer_id);
      await connection.commit();

      await logActivity(
        req.user.id,
        'Record Customer Refund',
        'Borrow',
        `Refunded ₹${payAmt} cash back to customer "${customer[0].name}"`,
        req.ip
      );

      const [updatedCust] = await connection.query('SELECT outstanding_balance, advance_balance FROM customers WHERE id = ?', [customer_id]);
      return res.status(200).json({ 
        success: true, 
        message: 'Cash refund recorded successfully',
        customer: updatedCust[0]
      });
    }

    if (typeUpper === 'ADVANCE' || typeUpper === 'ADVANCE DEPOSIT' || typeUpper === 'JAMA' || typeUpper === 'DEPOSIT') {
      await connection.query(
        'INSERT INTO borrow_records (customer_id, amount, type, date, notes) VALUES (?, ?, ?, ?, ?)',
        [customer_id, payAmt, 'Advance Deposit', date, remarks || 'Customer Advance Deposit (Jama)']
      );

      await syncCustomerBalances(connection, customer_id);
      await connection.commit();

      await logActivity(
        req.user.id,
        'Record Advance Deposit',
        'Borrow',
        `Recorded advance deposit of ₹${payAmt} for customer "${customer[0].name}"`,
        req.ip
      );

      const [updatedCust] = await connection.query('SELECT outstanding_balance, advance_balance FROM customers WHERE id = ?', [customer_id]);
      return res.status(200).json({ 
        success: true, 
        message: 'Advance deposit recorded successfully',
        customer: updatedCust[0]
      });
    }

    if (typeUpper === 'BORROW' || typeUpper === 'UDHAAR' || typeUpper === 'CREDIT') {
      let finalDueDate = req.body.due_date;
      if (!finalDueDate) {
        const d = new Date(date);
        d.setDate(d.getDate() + 15);
        finalDueDate = d.toISOString().split('T')[0];
      }

      await connection.query(
        `INSERT INTO borrow_transactions (
          customer_id, invoice_no, borrow_date, due_date, total_amount, paid_amount, remaining_amount, payment_status, remarks, created_by
        ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 'Pending', ?, ?)`,
        [customer_id, req.body.invoice_no || null, date, finalDueDate, payAmt, payAmt, remarks || 'Manual Udhaar Entry', req.user?.id || null]
      );

      await connection.query(
        'INSERT INTO borrow_records (customer_id, amount, type, date, notes) VALUES (?, ?, ?, ?, ?)',
        [customer_id, payAmt, 'Borrow', date, remarks || 'Manual Udhaar Entry']
      );

      await syncCustomerBalances(connection, customer_id);
      await connection.commit();

      await logActivity(
        req.user.id,
        'Record Manual Borrow',
        'Borrow',
        `Recorded manual credit entry of ₹${payAmt} for customer "${customer[0].name}"`,
        req.ip
      );

      const [updatedCust] = await connection.query('SELECT outstanding_balance, advance_balance FROM customers WHERE id = ?', [customer_id]);
      return res.status(200).json({ 
        success: true, 
        message: 'Credit (Udhaar) entry recorded successfully',
        customer: updatedCust[0]
      });
    }

    let remainingPayment = payAmt;

    // A. Specific transaction payment
    if (transaction_id) {
      const [tx] = await connection.query(
        'SELECT * FROM borrow_transactions WHERE id = ? AND customer_id = ?',
        [transaction_id, customer_id]
      );
      if (tx.length === 0) {
        return connection.rollback(), res.status(404).json({ success: false, message: 'Transaction not found for this customer' });
      }

      const curRemaining = Number(tx[0].remaining_amount);
      const amountToApply = Math.min(payAmt, curRemaining);

      const newPaid = Number(tx[0].paid_amount) + amountToApply;
      const newRemaining = Math.max(0, curRemaining - amountToApply);
      let status = 'Partial Paid';
      if (newRemaining === 0) {
        status = 'Paid';
      }

      await connection.query(
        'UPDATE borrow_transactions SET paid_amount = ?, remaining_amount = ?, payment_status = ? WHERE id = ?',
        [newPaid, newRemaining, status, transaction_id]
      );

      // Sync with Sales Invoice
      if (tx[0].invoice_no) {
        const [sales] = await connection.query(
          'SELECT id, total, amount_paid FROM sales WHERE invoice_no = ?',
          [tx[0].invoice_no]
        );
        if (sales.length > 0) {
          const saleObj = sales[0];
          const newSalePaid = Number(saleObj.amount_paid) + amountToApply;
          const newSaleDue = Math.max(0, Number(saleObj.total) - newSalePaid);
          let saleStatus = 'Partial';
          if (newSaleDue === 0) {
            saleStatus = 'Paid';
          } else if (newSalePaid === 0) {
            saleStatus = 'Pending';
          }

          await connection.query(
            'UPDATE sales SET amount_paid = ?, due_amount = ?, balance_amount = ?, payment_date = ?, payment_status = ? WHERE id = ?',
            [newSalePaid, newSaleDue, newSaleDue, date, saleStatus, saleObj.id]
          );
        }
      }

      remainingPayment -= amountToApply;
    }

    // B. Apply remaining payment across unpaid transactions FIFO
    if (remainingPayment > 0) {
      const [unpaidTx] = await connection.query(
        `SELECT * FROM borrow_transactions 
         WHERE customer_id = ? AND payment_status != 'Paid' ${transaction_id ? 'AND id != ?' : ''}
         ORDER BY borrow_date ASC, created_at ASC`,
        transaction_id ? [customer_id, transaction_id] : [customer_id]
      );

      for (const tx of unpaidTx) {
        if (remainingPayment <= 0) break;

        const currentRemaining = Number(tx.remaining_amount);
        const amountToApply = Math.min(remainingPayment, currentRemaining);
        
        const newPaid = Number(tx.paid_amount) + amountToApply;
        const newRemaining = currentRemaining - amountToApply;
        let status = 'Partial Paid';
        if (newRemaining === 0) {
          status = 'Paid';
        }

        await connection.query(
          'UPDATE borrow_transactions SET paid_amount = ?, remaining_amount = ?, payment_status = ? WHERE id = ?',
          [newPaid, newRemaining, status, tx.id]
        );

        // Sync with Sales Invoice
        if (tx.invoice_no) {
          const [sales] = await connection.query(
            'SELECT id, total, amount_paid FROM sales WHERE invoice_no = ?',
            [tx.invoice_no]
          );
          if (sales.length > 0) {
            const saleObj = sales[0];
            const newSalePaid = Number(saleObj.amount_paid) + amountToApply;
            const newSaleDue = Math.max(0, Number(saleObj.total) - newSalePaid);
            let saleStatus = 'Partial';
            if (newSaleDue === 0) {
              saleStatus = 'Paid';
            } else if (newSalePaid === 0) {
              saleStatus = 'Pending';
            }

            await connection.query(
              'UPDATE sales SET amount_paid = ?, due_amount = ?, balance_amount = ?, payment_date = ?, payment_status = ? WHERE id = ?',
              [newSalePaid, newSaleDue, newSaleDue, date, saleStatus, saleObj.id]
            );
          }
        }

        remainingPayment -= amountToApply;
      }
    }

    // C. Record payback entry in borrow_records
    await connection.query(
      'INSERT INTO borrow_records (customer_id, amount, type, date, notes) VALUES (?, ?, ?, ?, ?)',
      [customer_id, payAmt, 'Payback', date, remarks || 'Udhaar Payback Payment']
    );

    // D. Synchronize customer balances (which auto-credits any excess remainingPayment to advance_balance)
    await syncCustomerBalances(connection, customer_id);

    await connection.commit();

    await logActivity(
      req.user.id,
      'Record Payback',
      'Borrow',
      `Recorded payment of ₹${payAmt} from customer "${customer[0].name}"`,
      req.ip
    );

    await createNotification({
      tenantId: req.tenantId,
      user_id: req.user?.id,
      type: 'Customer Payback',
      title: 'Udhaar Payback Received',
      message: `Payback payment of ₹${payAmt.toLocaleString('en-IN')} received from "${customer[0].name}".`,
      priority: 'Medium',
      related_user: req.user?.name || req.user?.email || 'Staff',
      module: 'Customer',
      related_module: 'Customer',
      reference_id: customer_id,
      reference_type: 'BorrowPayback',
      target_roles: 'Admin,Manager,Staff'
    });

    const [updatedCust] = await connection.query('SELECT outstanding_balance, advance_balance FROM customers WHERE id = ?', [customer_id]);
    return res.status(200).json({ 
      success: true, 
      message: 'Payment recorded successfully',
      customer: updatedCust[0]
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

// @desc    Get dashboard KPIs/Statistics for Customers & Udhaar
// @route   GET /api/borrow/kpis
// @access  Private
export const getBorrowKPIs = async (req, res, next) => {
  try {
    // 1. Total, Walk-in, Borrow Customers
    const [counts] = await req.db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN customer_type = 'Walk-in' THEN 1 END) as walkin,
        COUNT(CASE WHEN customer_type = 'Borrow' THEN 1 END) as borrow
      FROM customers
    `);

    // 2. Outstanding & Pending amounts
    const [balances] = await req.db.query(`
      SELECT 
        COALESCE(SUM(remaining_amount), 0) as pending_amount,
        COUNT(DISTINCT CASE WHEN remaining_amount > 0 THEN customer_id END) as active_debtors
      FROM borrow_transactions
      WHERE payment_status != 'Paid'
    `);

    // 3. Today's collections
    const [collections] = await req.db.query(`
      SELECT COALESCE(SUM(amount), 0) as todays_collection
      FROM borrow_records
      WHERE type = 'Payback' AND DATE(date) = CURRENT_DATE()
    `);

    return res.status(200).json({
      success: true,
      stats: {
        totalCustomers: counts[0].total,
        walkinCustomers: counts[0].walkin,
        borrowCustomers: counts[0].borrow,
        totalOutstandingAmount: balances[0].pending_amount,
        pendingBorrowAmount: balances[0].pending_amount,
        activeDebtors: balances[0].active_debtors,
        overdueCustomers: balances[0].active_debtors,
        todaysCollections: collections[0].todays_collection
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Void credit transaction
// @route   DELETE /api/borrow/transactions/:id
// @access  Private
export const deleteBorrowTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [existing] = await req.db.query('SELECT * FROM borrow_transactions WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Transaction record not found' });
    }

    const custId = existing[0].customer_id;

    // Delete record
    await req.db.query('DELETE FROM borrow_transactions WHERE id = ?', [id]);

    await syncCustomerBalances(req.db, custId);

    await logActivity(
      req.user.id,
      'Void Borrow Transaction',
      'Borrow',
      `Voided credit transaction ID: ${id} (Amount: ₹${existing[0].total_amount})`,
      req.ip
    );

    return res.status(200).json({ success: true, message: 'Transaction voided successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete/Void credit or payback transaction log
// @route   DELETE /api/borrow/:id
// @access  Private
export const deleteBorrowRecord = async (req, res, next) => {
  const connection = await req.db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Check if ID exists in borrow_records
    const [records] = await connection.query('SELECT * FROM borrow_records WHERE id = ?', [id]);
    
    let targetCustId = null;

    if (records.length > 0) {
      const rec = records[0];
      targetCustId = rec.customer_id;
      
      // If it's a Borrow entry, try deleting corresponding borrow_transaction if it exists
      if (rec.type === 'Borrow') {
        await connection.query(
          'DELETE FROM borrow_transactions WHERE customer_id = ? AND total_amount = ? AND DATE(borrow_date) = DATE(?) LIMIT 1',
          [rec.customer_id, rec.amount, rec.date]
        );
      } else if (rec.type === 'Payback') {
        // Revert payback amount on customer's borrow_transactions
        const [transactions] = await connection.query(
          `SELECT * FROM borrow_transactions 
           WHERE customer_id = ? AND paid_amount > 0 
           ORDER BY updated_at DESC, id DESC`,
          [rec.customer_id]
        );

        let remainingRevert = Number(rec.amount);
        for (const tx of transactions) {
          if (remainingRevert <= 0) break;
          const paid = Number(tx.paid_amount);
          const revertAmount = Math.min(paid, remainingRevert);
          const newPaid = paid - revertAmount;
          const newRemaining = Number(tx.remaining_amount) + revertAmount;
          const status = newPaid === 0 ? 'Pending' : 'Partial Paid';

          await connection.query(
            'UPDATE borrow_transactions SET paid_amount = ?, remaining_amount = ?, payment_status = ? WHERE id = ?',
            [newPaid, newRemaining, status, tx.id]
          );

          remainingRevert -= revertAmount;
        }
      }

      await connection.query('DELETE FROM borrow_records WHERE id = ?', [id]);

      // Re-sync customer balances
      await syncCustomerBalances(connection, rec.customer_id);
    } else {
      // Check in borrow_transactions table
      const [txs] = await connection.query('SELECT * FROM borrow_transactions WHERE id = ?', [id]);
      if (txs.length > 0) {
        const custId = txs[0].customer_id;
        targetCustId = custId;
        await connection.query('DELETE FROM borrow_transactions WHERE id = ?', [id]);
        await syncCustomerBalances(connection, custId);
      } else {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Transaction log record not found' });
      }
    }

    await connection.commit();

    let updatedCustomer = null;
    if (targetCustId) {
      const [custRows] = await req.db.query('SELECT outstanding_balance, advance_balance FROM customers WHERE id = ?', [targetCustId]);
      if (custRows.length > 0) updatedCustomer = custRows[0];
    }

    await logActivity(
      req.user.id,
      'Void Borrow Record',
      'Borrow',
      `Voided borrow ledger record ID: ${id}`,
      req.ip
    );

    return res.status(200).json({ 
      success: true, 
      message: 'Transaction log voided successfully',
      customer: updatedCustomer
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};
