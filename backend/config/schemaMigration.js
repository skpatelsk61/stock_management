import fs from 'fs';
import path from 'path';
import { syncProductFifoState } from '../utils/fifoQueueHelper.js';

export const runCategorySchemaMigrations = async (pool) => {
  try {
    // 1. Ensure sub_categories table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sub_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INT NOT NULL,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_subcat_category (category_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Ensure brands table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        description TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Ensure columns sub_category_id and brand_id exist on products table
    const [cols] = await pool.query('DESCRIBE products');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('sub_category_id')) {
      await pool.query('ALTER TABLE products ADD COLUMN sub_category_id INT NULL AFTER category_id');
    }
    if (!colNames.includes('brand_id')) {
      await pool.query('ALTER TABLE products ADD COLUMN brand_id INT NULL AFTER sub_category_id');
    }

    // 4. Ensure sale_payments table exists for Split Payment / Multiple Payment Modes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sale_payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NULL,
        sale_id INT NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        reference_no VARCHAR(100) NULL,
        notes VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sale_payments_sale (sale_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      const [spCols] = await pool.query('DESCRIBE sale_payments');
      const spColNames = spCols.map(c => c.Field);
      if (!spColNames.includes('tenant_id')) {
        await pool.query('ALTER TABLE sale_payments ADD COLUMN tenant_id INT NULL AFTER id');
      }
    } catch (e) {
      console.warn('[Schema Migration] sale_payments table check:', e.message);
    }

    // 4a. Ensure customers table has notes, opening_balance, credit_limit, outstanding_balance, payment_mode, etc.
    try {
      const [custCols] = await pool.query('DESCRIBE customers');
      const custColNames = custCols.map(c => c.Field);
      if (!custColNames.includes('customer_code')) {
        await pool.query('ALTER TABLE customers ADD COLUMN customer_code VARCHAR(50) NULL AFTER id');
      }
      if (!custColNames.includes('notes')) {
        await pool.query('ALTER TABLE customers ADD COLUMN notes TEXT NULL AFTER address');
      }
      if (!custColNames.includes('opening_balance')) {
        await pool.query('ALTER TABLE customers ADD COLUMN opening_balance DECIMAL(12,2) DEFAULT 0.00 AFTER notes');
      }
      if (!custColNames.includes('credit_limit')) {
        await pool.query('ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(12,2) DEFAULT 0.00 AFTER opening_balance');
      }
      if (!custColNames.includes('outstanding_balance')) {
        await pool.query('ALTER TABLE customers ADD COLUMN outstanding_balance DECIMAL(12,2) DEFAULT 0.00 AFTER credit_limit');
      }
      if (!custColNames.includes('payment_mode')) {
        await pool.query('ALTER TABLE customers ADD COLUMN payment_mode VARCHAR(50) DEFAULT "Cash" AFTER status');
      }
      if (!custColNames.includes('expires_at')) {
        await pool.query('ALTER TABLE customers ADD COLUMN expires_at DATETIME NULL AFTER updated_by');
      }
    } catch (e) {
      console.warn('[Schema Migration] customers table check:', e.message);
    }

    // 4a-2. Ensure vendors table has advance_balance column
    try {
      const [vCols] = await pool.query('DESCRIBE vendors');
      const vColNames = vCols.map(c => c.Field);
      if (!vColNames.includes('advance_balance')) {
        await pool.query('ALTER TABLE vendors ADD COLUMN advance_balance DECIMAL(12,2) DEFAULT 0.00 AFTER outstanding_balance');
      }
    } catch (e) {
      console.warn('[Schema Migration] vendors table check:', e.message);
    }

    // 4b. Per-user notification state for non-admin staff.
    // Admin continues to use notifications.is_read/delete directly.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_user_states (
        notification_id INT NOT NULL,
        user_id INT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        is_deleted TINYINT(1) NOT NULL DEFAULT 0,
        read_at TIMESTAMP NULL,
        deleted_at TIMESTAMP NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (notification_id, user_id),
        INDEX idx_notification_user_states_user (user_id, is_deleted, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Ensure batch-wise MRP columns exist across purchase_batches, sale_items, and purchase_items
    try {
      const [pbCols] = await pool.query('DESCRIBE purchase_batches');
      const pbColNames = pbCols.map(c => c.Field);
      if (!pbColNames.includes('mrp')) {
        await pool.query('ALTER TABLE purchase_batches ADD COLUMN mrp DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER purchase_price');
      }
      if (!pbColNames.includes('selling_price')) {
        await pool.query('ALTER TABLE purchase_batches ADD COLUMN selling_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER mrp');
      }
    } catch (e) {
      console.warn('[Schema Migration] purchase_batches table check:', e.message);
    }

    try {
      const [siCols] = await pool.query('DESCRIBE sale_items');
      const siColNames = siCols.map(c => c.Field);
      if (!siColNames.includes('mrp')) {
        await pool.query('ALTER TABLE sale_items ADD COLUMN mrp DECIMAL(12,2) NULL AFTER selling_price');
      }
      if (!siColNames.includes('batch_number')) {
        await pool.query('ALTER TABLE sale_items ADD COLUMN batch_number VARCHAR(100) NULL AFTER mrp');
      }
    } catch (e) {
      console.warn('[Schema Migration] sale_items table check:', e.message);
    }

    try {
      const [piCols] = await pool.query('DESCRIBE purchase_items');
      const piColNames = piCols.map(c => c.Field);
      if (!piColNames.includes('mrp')) {
        await pool.query('ALTER TABLE purchase_items ADD COLUMN mrp DECIMAL(12,2) NULL AFTER purchase_price');
      }
    } catch (e) {
      console.warn('[Schema Migration] purchase_items table check:', e.message);
    }

    try {
      const [giCols] = await pool.query('DESCRIBE grn_items');
      const giColNames = giCols.map(c => c.Field);
      if (!giColNames.includes('selling_price')) {
        await pool.query('ALTER TABLE grn_items ADD COLUMN selling_price DECIMAL(12,2) NULL AFTER mrp');
      }
    } catch (e) {
      console.warn('[Schema Migration] grn_items table check:', e.message);
    }

    try {
      const [vCols] = await pool.query('DESCRIBE vendors');
      const vColNames = vCols.map(c => c.Field);
      const expectedVendorCols = [
        { name: 'supplier_code', type: 'VARCHAR(50) NULL' },
        { name: 'company_name', type: 'VARCHAR(150) NULL' },
        { name: 'contact_person', type: 'VARCHAR(150) NULL' },
        { name: 'alternate_phone', type: 'VARCHAR(20) NULL' },
        { name: 'pan', type: 'VARCHAR(10) NULL' },
        { name: 'city', type: 'VARCHAR(100) NULL' },
        { name: 'state', type: 'VARCHAR(100) NULL' },
        { name: 'pincode', type: 'VARCHAR(20) NULL' },
        { name: 'categories_supplied', type: 'TEXT NULL' },
        { name: 'payment_terms', type: 'VARCHAR(100) NULL' },
        { name: 'credit_limit', type: 'DECIMAL(12,2) DEFAULT 0.00' },
        { name: 'opening_balance', type: 'DECIMAL(12,2) DEFAULT 0.00' },
        { name: 'opening_balance_type', type: "ENUM('Payable', 'Advance') DEFAULT 'Payable'" },
        { name: 'notes', type: 'TEXT NULL' },
        { name: 'bank_name', type: 'VARCHAR(100) NULL' },
        { name: 'account_number', type: 'VARCHAR(50) NULL' },
        { name: 'ifsc_code', type: 'VARCHAR(20) NULL' }
      ];
      for (const col of expectedVendorCols) {
        if (!vColNames.includes(col.name)) {
          await pool.query(`ALTER TABLE vendors ADD COLUMN ${col.name} ${col.type}`);
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] vendors table check:', e.message);
    }

    try {
      const [slCols] = await pool.query('DESCRIBE stock_logs');
      const slColNames = slCols.map(c => c.Field);
      const expectedStockLogCols = [
        { name: 'previous_quantity', type: 'INT NULL DEFAULT 0' },
        { name: 'new_quantity', type: 'INT NULL DEFAULT 0' },
        { name: 'batch_number', type: 'VARCHAR(100) NULL' },
        { name: 'mrp', type: 'DECIMAL(12,2) NULL' },
        { name: 'unit_price', type: 'DECIMAL(12,2) NULL' }
      ];
      for (const col of expectedStockLogCols) {
        if (!slColNames.includes(col.name)) {
          await pool.query(`ALTER TABLE stock_logs ADD COLUMN ${col.name} ${col.type}`);
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] stock_logs table check:', e.message);
    }

    try {
      const [purCols] = await pool.query('DESCRIBE purchases');
      const purColNames = purCols.map(c => c.Field);
      if (!purColNames.includes('purchase_order_id')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN purchase_order_id INT NULL AFTER purchase_no');
      }
      if (!purColNames.includes('grn_id')) {
        await pool.query('ALTER TABLE purchases ADD COLUMN grn_id INT NULL AFTER purchase_order_id');
      }
    } catch (e) {
      console.warn('[Schema Migration] purchases table check:', e.message);
    }

    try {
      const [prodCols] = await pool.query('DESCRIBE products');
      const prodColNames = prodCols.map(c => c.Field);
      if (!prodColNames.includes('measurement_value')) {
        await pool.query('ALTER TABLE products ADD COLUMN measurement_value VARCHAR(100) NULL AFTER unit');
      }
    } catch (e) {
      console.warn('[Schema Migration] products table check:', e.message);
    }

    try {
      const [sCols] = await pool.query('DESCRIBE sales');
      const sColNames = sCols.map(c => c.Field);
      const expectedSalesCols = [
        { name: 'amount_paid', type: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
        { name: 'due_amount', type: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
        { name: 'balance_amount', type: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00' },
        { name: 'payment_date', type: 'DATE NULL' },
        { name: 'notes', type: 'TEXT NULL' }
      ];
      for (const col of expectedSalesCols) {
        if (!sColNames.includes(col.name)) {
          await pool.query(`ALTER TABLE sales ADD COLUMN ${col.name} ${col.type}`);
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] sales table check:', e.message);
    }

    // ── ENSURE SALES_RETURNS TABLE HAS ALL ENHANCED COLUMNS ──
    try {
      const [srCols] = await pool.query('DESCRIBE sales_returns');
      const srColNames = srCols.map(c => c.Field);
      const expectedSrCols = [
        { name: 'return_no', type: 'VARCHAR(50) NULL' },
        { name: 'customer_name', type: 'VARCHAR(255) NULL' },
        { name: 'customer_phone', type: 'VARCHAR(50) NULL' },
        { name: 'return_type', type: "VARCHAR(50) DEFAULT 'Refund'" },
        { name: 'refund_method', type: "VARCHAR(50) DEFAULT 'Cash'" },
        { name: 'remarks', type: 'TEXT NULL' },
        { name: 'replacement_product_id', type: 'INT NULL' },
        { name: 'replacement_quantity', type: 'INT NULL' },
        { name: 'price_difference', type: 'DECIMAL(10,2) DEFAULT 0.00' },
        { name: 'user_id', type: 'INT NULL' }
      ];
      for (const col of expectedSrCols) {
        if (!srColNames.includes(col.name)) {
          await pool.query(`ALTER TABLE sales_returns ADD COLUMN ${col.name} ${col.type}`);
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] sales_returns table check:', e.message);
    }

    // ── AUTO-REPAIR CUSTOMERS TABLE ADVANCE BALANCE COLUMN ──
    try {
      const [cCols] = await pool.query('DESCRIBE customers');
      const cColNames = cCols.map(c => c.Field);
      if (!cColNames.includes('advance_balance')) {
        await pool.query('ALTER TABLE customers ADD COLUMN advance_balance DECIMAL(12,2) DEFAULT 0.00');
      }
    } catch (e) {
      console.warn('[Schema Migration] customers advance_balance check:', e.message);
    }

    // ── AUTO-REPAIR BORROW_RECORDS TYPE COLUMN TO VARCHAR(50) ──
    try {
      await pool.query('ALTER TABLE borrow_records MODIFY COLUMN type VARCHAR(50) NOT NULL');
    } catch (e) {
      console.warn('[Schema Migration] borrow_records type column modify check:', e.message);
    }

    // ── ALTER QUANTITY COLUMNS TO DECIMAL(12,3) FOR LOOSE / WEIGHT / VOLUME / FRACTIONAL SELLING ──
    try {
      await pool.query('ALTER TABLE stock MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000');
      await pool.query('ALTER TABLE sale_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000');
      await pool.query('ALTER TABLE purchase_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000');
      await pool.query('ALTER TABLE purchase_batches MODIFY COLUMN purchase_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000, MODIFY COLUMN remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000');
      await pool.query('ALTER TABLE stock_logs MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000, MODIFY COLUMN previous_quantity DECIMAL(12,3) NULL DEFAULT 0.000, MODIFY COLUMN new_quantity DECIMAL(12,3) NULL DEFAULT 0.000');
      await pool.query('ALTER TABLE grn_items MODIFY COLUMN quantity_received DECIMAL(12,3) NOT NULL DEFAULT 0.000, MODIFY COLUMN quantity_damaged DECIMAL(12,3) NOT NULL DEFAULT 0.000, MODIFY COLUMN quantity_rejected DECIMAL(12,3) NOT NULL DEFAULT 0.000');
    } catch (e) {
      console.warn('[Schema Migration] DECIMAL quantity column modify check:', e.message);
    }

    // ── AUTO-REPAIR PURCHASE_BATCHES WITH ZERO PURCHASE_PRICE OR MISSING PRICES ──
    try {
      await pool.query(`
        UPDATE purchase_batches pb
        JOIN purchase_items pi ON (pb.purchase_id = pi.purchase_id OR pb.grn_id = pi.purchase_id) AND pb.product_id = pi.product_id
        SET pb.purchase_price = pi.purchase_price
        WHERE pb.purchase_price = 0 AND pi.purchase_price > 0
      `);
      await pool.query(`
        UPDATE purchase_batches pb
        JOIN products p ON pb.product_id = p.id
        SET pb.purchase_price = p.purchase_price
        WHERE pb.purchase_price = 0 AND p.purchase_price > 0
      `);
      await pool.query(`
        UPDATE purchase_batches pb
        JOIN products p ON pb.product_id = p.id
        SET pb.mrp = IF(pb.mrp = 0 AND p.mrp > 0, p.mrp, pb.mrp),
            pb.selling_price = IF(pb.selling_price = 0 AND p.selling_price > 0, p.selling_price, pb.selling_price)
        WHERE (pb.mrp = 0 AND p.mrp > 0) OR (pb.selling_price = 0 AND p.selling_price > 0)
      `);
    } catch (e) {
      console.warn('[Schema Migration] Batch data repair check:', e.message);
    }

    // ── ENSURE WAREHOUSES TABLE EXISTS & SEED DEFAULT WAREHOUSE ──
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS warehouses (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          location VARCHAR(255) NULL,
          status VARCHAR(20) DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [whCount] = await pool.query('SELECT COUNT(*) as cnt FROM warehouses');
      if (whCount[0]?.cnt === 0) {
        await pool.query(`
          INSERT IGNORE INTO warehouses (id, name, location, status) VALUES
          (1, 'Main Storage', 'Ground Floor Stockroom', 'Active')
        `);
      }
    } catch (e) {
      console.warn('[Schema Migration] warehouses table check:', e.message);
    }

    // ── ENSURE STOCK_DESTROYS TABLE & FULL ODOO SCRAP SCHEMA EXIST ──
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_destroys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          destroy_no VARCHAR(50) NOT NULL UNIQUE,
          product_id INT NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          barcode VARCHAR(100) NULL,
          sku VARCHAR(100) NULL,
          batch_no VARCHAR(100) NULL,
          batch_id INT NULL,
          warehouse_name VARCHAR(100) DEFAULT 'Main Storage',
          source_location VARCHAR(150) DEFAULT 'Main Storage',
          scrap_location VARCHAR(150) DEFAULT 'Scrap / Inventory Loss Location',
          available_stock DECIMAL(12,3) DEFAULT 0.000,
          destroy_quantity DECIMAL(12,3) NOT NULL,
          unit VARCHAR(50) DEFAULT 'Pcs',
          unit_cost DECIMAL(12,2) DEFAULT 0.00,
          purchase_price DECIMAL(12,2) DEFAULT 0.00,
          selling_price DECIMAL(12,2) DEFAULT 0.00,
          destroy_value DECIMAL(12,2) NOT NULL,
          reason VARCHAR(100) NOT NULL,
          remarks TEXT NULL,
          evidence_image LONGTEXT NULL,
          destroyed_by_id INT NULL,
          destroyed_by_name VARCHAR(255) NULL,
          status ENUM('Draft', 'Confirmed', 'Cancelled') DEFAULT 'Confirmed',
          cancel_reason TEXT NULL,
          cancelled_by_name VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_destroy_no (destroy_no),
          INDEX idx_product_id (product_id),
          INDEX idx_batch_id (batch_id),
          INDEX idx_status (status),
          INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      const [destCols] = await pool.query('DESCRIBE stock_destroys');
      const destColNames = destCols.map(c => c.Field);

      const requiredScrapCols = [
        { name: 'batch_id', spec: 'INT NULL AFTER batch_no' },
        { name: 'source_location', spec: 'VARCHAR(150) DEFAULT "Main Storage" AFTER warehouse_name' },
        { name: 'scrap_location', spec: 'VARCHAR(150) DEFAULT "Scrap / Inventory Loss Location" AFTER source_location' },
        { name: 'unit_cost', spec: 'DECIMAL(12,2) DEFAULT 0.00 AFTER unit' }
      ];

      for (const col of requiredScrapCols) {
        if (!destColNames.includes(col.name)) {
          try {
            await pool.query(`ALTER TABLE stock_destroys ADD COLUMN ${col.name} ${col.spec}`);
          } catch (colErr) {
            // Ignore if column already exists
          }
        }
      }

      try {
        if (!destColNames.includes('status')) {
          await pool.query('ALTER TABLE stock_destroys ADD COLUMN status ENUM("Draft", "Confirmed", "Cancelled") DEFAULT "Confirmed"');
        } else {
          await pool.query('ALTER TABLE stock_destroys MODIFY COLUMN status ENUM("Draft", "Confirmed", "Cancelled") DEFAULT "Confirmed"');
        }
      } catch (stErr) {
        // Ignore status modification if already compliant
      }
    } catch (e) {
      console.warn('[Schema Migration] stock_destroys table check:', e.message);
    }

    // ── ENSURE STOCK_ADJUSTMENTS TABLE HAS SELLING_PRICE & MRP COLUMNS ──
    try {
      const [adjCols] = await pool.query('DESCRIBE stock_adjustments');
      const adjColNames = adjCols.map(c => c.Field);
      if (!adjColNames.includes('selling_price')) {
        await pool.query('ALTER TABLE stock_adjustments ADD COLUMN selling_price DECIMAL(12,2) DEFAULT 0.00 AFTER unit_cost');
      }
      if (!adjColNames.includes('mrp')) {
        await pool.query('ALTER TABLE stock_adjustments ADD COLUMN mrp DECIMAL(12,2) DEFAULT 0.00 AFTER selling_price');
      }
    } catch (e) {
      console.warn('[Schema Migration] stock_adjustments check:', e.message);
    }

    // ── ENSURE MULTI-WAREHOUSE STOCK_TRANSFERS TABLE & COLUMNS EXIST ──
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS stock_transfers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          transfer_no VARCHAR(50) UNIQUE NOT NULL,
          from_warehouse_id INT NOT NULL,
          to_warehouse_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      const [existingCols] = await pool.query('DESCRIBE stock_transfers');
      const existingColNames = existingCols.map(c => c.Field);

      const requiredCols = [
        { name: 'product_id', spec: 'INT NOT NULL AFTER transfer_no' },
        { name: 'product_name', spec: 'VARCHAR(255) NOT NULL AFTER product_id' },
        { name: 'barcode', spec: 'VARCHAR(100) DEFAULT "N/A" AFTER product_name' },
        { name: 'sku', spec: 'VARCHAR(100) DEFAULT "N/A" AFTER barcode' },
        { name: 'from_warehouse_name', spec: 'VARCHAR(255) DEFAULT "Main Storage" AFTER from_warehouse_id' },
        { name: 'to_warehouse_name', spec: 'VARCHAR(255) DEFAULT "Secondary Warehouse" AFTER to_warehouse_id' },
        { name: 'batch_id', spec: 'INT NULL AFTER to_warehouse_name' },
        { name: 'batch_no', spec: 'VARCHAR(100) DEFAULT "DEFAULT" AFTER batch_id' },
        { name: 'expiry_date', spec: 'DATE NULL AFTER batch_no' },
        { name: 'quantity', spec: 'DECIMAL(12,3) NOT NULL DEFAULT 0.000 AFTER expiry_date' },
        { name: 'in_transit_quantity', spec: 'DECIMAL(12,3) DEFAULT 0.000 AFTER quantity' },
        { name: 'unit', spec: 'VARCHAR(50) DEFAULT "Pcs" AFTER in_transit_quantity' },
        { name: 'unit_cost', spec: 'DECIMAL(12,2) DEFAULT 0.00 AFTER unit' },
        { name: 'total_value', spec: 'DECIMAL(12,2) DEFAULT 0.00 AFTER unit_cost' },
        { name: 'remarks', spec: 'TEXT NULL' },
        { name: 'cancel_reason', spec: 'TEXT NULL' },
        { name: 'created_by', spec: 'INT NULL AFTER cancel_reason' },
        { name: 'created_by_name', spec: 'VARCHAR(255) DEFAULT "Admin"' },
        { name: 'received_by', spec: 'INT NULL' },
        { name: 'received_by_name', spec: 'VARCHAR(255) NULL' },
        { name: 'shipped_at', spec: 'DATETIME NULL' },
        { name: 'received_at', spec: 'DATETIME NULL' }
      ];

      for (const col of requiredCols) {
        if (!existingColNames.includes(col.name)) {
          await pool.query(`ALTER TABLE stock_transfers ADD COLUMN ${col.name} ${col.spec}`);
        }
      }

      if (!existingColNames.includes('status')) {
        await pool.query(`ALTER TABLE stock_transfers ADD COLUMN status ENUM('Draft', 'In Transit', 'Pending', 'In-Transit', 'Completed', 'Cancelled') DEFAULT 'In Transit'`);
      } else {
        await pool.query(`ALTER TABLE stock_transfers MODIFY COLUMN status ENUM('Draft', 'In Transit', 'Pending', 'In-Transit', 'Completed', 'Cancelled') DEFAULT 'In Transit'`);
      }
    } catch (e) {
      console.warn('[Schema Migration] stock_transfers table check:', e.message);
    }

    // ── ENSURE INVENTORY_VALUATION_LAYERS TABLE & ENUM EXPANSION ──
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_valuation_layers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          product_id INT NOT NULL,
          warehouse_id INT NOT NULL DEFAULT 1,
          batch_id INT NULL,
          transaction_type ENUM('Purchase Receipt', 'Sales Delivery', 'Sales Return', 'Purchase Return', 'Stock Adjustment', 'Scrap/Wastage', 'Stock Transfer', 'Transfer Out', 'Transfer In', 'Transfer Reversal', 'Revaluation') NOT NULL,
          reference_no VARCHAR(100) NOT NULL,
          quantity_delta DECIMAL(12,3) NOT NULL,
          unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          value_delta DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          previous_inventory_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          new_inventory_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          previous_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.00,
          new_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.00,
          accounting_treatment VARCHAR(100) NULL DEFAULT 'Inventory Variation',
          created_by INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ivl_product (product_id),
          INDEX idx_ivl_type (transaction_type),
          INDEX idx_ivl_ref (reference_no)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        ALTER TABLE inventory_valuation_layers
        MODIFY COLUMN transaction_type ENUM(
          'Purchase Receipt', 'Sales Delivery', 'Sales Return', 'Purchase Return',
          'Stock Adjustment', 'Scrap/Wastage', 'Stock Transfer', 'Transfer Out',
          'Transfer In', 'Transfer Reversal', 'Revaluation'
        ) NOT NULL
      `);
    } catch (e) {
      console.warn('[Schema Migration] inventory_valuation_layers check:', e.message);
    }

    // 5. Ensure customer balances (advance_balance & outstanding_balance) are synced
    try {
      const [customers] = await pool.query('SELECT id FROM customers WHERE name != "Walk-in Customer"');
      for (const c of customers) {
        const [btRows] = await pool.query(
          `SELECT COALESCE(SUM(remaining_amount), 0) as total_due 
           FROM borrow_transactions 
           WHERE customer_id = ? AND payment_status != 'Paid'`,
          [c.id]
        );
        const totalDue = Number(btRows[0]?.total_due || 0);

        const [brRows] = await pool.query(
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

        for (const row of brRows) {
          const amt = Number(row.total_amt);
          if (row.type === 'Borrow') totalBorrows += amt;
          else if (row.type === 'Payback') totalPaybacks += amt;
          else if (row.type === 'Advance Deposit') totalAdvanceDeposits += amt;
          else if (row.type === 'Return') totalReturns += amt;
          else if (row.type === 'Refund' || row.type === 'Cash Refund') totalRefunds += amt;
        }

        const netCredits = (totalPaybacks + totalAdvanceDeposits + totalReturns) - (totalBorrows + totalRefunds);

        let newAdvance = 0;
        if (totalDue === 0 && netCredits > 0) {
          newAdvance = netCredits;
        } else if (netCredits > totalDue && totalDue > 0) {
          newAdvance = netCredits - totalDue;
        }

        await pool.query(
          'UPDATE customers SET outstanding_balance = ?, advance_balance = ? WHERE id = ?',
          [totalDue, newAdvance, c.id]
        );
      }
    } catch (e) {
      console.warn('[Schema Migration] customer balance sync check:', e.message);
    }

    // 6. Ensure purchase_order_items and grn_items have damage/delivery tracking columns
    try {
      const [poiCols] = await pool.query('DESCRIBE purchase_order_items');
      const poiColNames = poiCols.map(c => c.Field);
      if (!poiColNames.includes('delivered_quantity')) {
        await pool.query('ALTER TABLE purchase_order_items ADD COLUMN delivered_quantity DECIMAL(12,3) DEFAULT 0.000 AFTER quantity');
      }
      if (!poiColNames.includes('damaged_quantity')) {
        await pool.query('ALTER TABLE purchase_order_items ADD COLUMN damaged_quantity DECIMAL(12,3) DEFAULT 0.000 AFTER delivered_quantity');
      }
      if (!poiColNames.includes('rejected_quantity')) {
        await pool.query('ALTER TABLE purchase_order_items ADD COLUMN rejected_quantity DECIMAL(12,3) DEFAULT 0.000 AFTER damaged_quantity');
      }
    } catch (e) {
      console.warn('[Schema Migration] purchase_order_items columns check:', e.message);
    }

    try {
      const [grnCols] = await pool.query('DESCRIBE grn_items');
      const grnColNames = grnCols.map(c => c.Field);
      if (!grnColNames.includes('quantity_damaged')) {
        await pool.query('ALTER TABLE grn_items ADD COLUMN quantity_damaged DECIMAL(12,3) NOT NULL DEFAULT 0.000 AFTER quantity_received');
      }
      if (!grnColNames.includes('quantity_rejected')) {
        await pool.query('ALTER TABLE grn_items ADD COLUMN quantity_rejected DECIMAL(12,3) NOT NULL DEFAULT 0.000 AFTER quantity_damaged');
      }
      if (!grnColNames.includes('quantity_missing')) {
        await pool.query('ALTER TABLE grn_items ADD COLUMN quantity_missing DECIMAL(12,3) NOT NULL DEFAULT 0.000 AFTER quantity_rejected');
      }
      if (!grnColNames.includes('selling_price')) {
        await pool.query('ALTER TABLE grn_items ADD COLUMN selling_price DECIMAL(12,2) NULL AFTER mrp');
      }
    } catch (e) {
      console.warn('[Schema Migration] grn_items columns check:', e.message);
    }

    // 7. Auto-reconcile purchase_order_items delivered & damaged metrics from grn_items
    try {
      await pool.query(`
        UPDATE purchase_order_items poi
        JOIN (
          SELECT g.purchase_order_id, gi.product_id, 
                 SUM(gi.quantity_received) as total_del, 
                 SUM(gi.quantity_damaged) as total_dam, 
                 SUM(gi.quantity_rejected) as total_rej
          FROM grn_items gi
          JOIN grns g ON gi.grn_id = g.id
          GROUP BY g.purchase_order_id, gi.product_id
        ) g_sum ON poi.purchase_order_id = g_sum.purchase_order_id AND poi.product_id = g_sum.product_id
        SET poi.delivered_quantity = g_sum.total_del,
            poi.damaged_quantity = g_sum.total_dam,
            poi.rejected_quantity = g_sum.total_rej,
            poi.received_quantity = GREATEST(0, g_sum.total_del - g_sum.total_dam - g_sum.total_rej)
        WHERE (poi.damaged_quantity = 0 OR poi.damaged_quantity IS NULL) AND g_sum.total_dam > 0
      `);

      await pool.query(`
        UPDATE purchase_order_items 
        SET delivered_quantity = received_quantity 
        WHERE (delivered_quantity = 0 OR delivered_quantity IS NULL) AND received_quantity > 0
      `);
    } catch (e) {
      console.warn('[Schema Migration] purchase_order_items reconciliation check:', e.message);
    }

    // 8. Auto-synchronize product commercial pricing (selling_price, mrp, purchase_price, gst, expiry_date) from active batches & POs
    try {
      const [prodsWithBatches] = await pool.query(
        `SELECT DISTINCT product_id FROM purchase_batches UNION SELECT DISTINCT product_id FROM grn_items`
      );
      for (const row of prodsWithBatches) {
        if (row.product_id) {
          await syncProductFifoState(pool, row.product_id);
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] FIFO product pricing sync check:', e.message);
    }

    // 9. Auto-reconcile unbilled GRNs into purchases and vendor ledger
    try {
      const [unbilledGRNs] = await pool.query(`
        SELECT g.id as grn_id, g.grn_no, g.purchase_order_id, g.vendor_id, g.warehouse_id, g.date
        FROM grns g
        WHERE NOT EXISTS (
          SELECT 1 FROM purchases p WHERE p.grn_id = g.id
        )
      `);

      for (const uGrn of unbilledGRNs) {
        // Check if this PO already has a purchase
        const [existingPurch] = await pool.query(
          'SELECT id, purchase_no, subtotal, gst_amount, total FROM purchases WHERE purchase_order_id = ? LIMIT 1',
          [uGrn.purchase_order_id]
        );

        // Calculate GRN totals from grn_items and PO item purchase_price
        const [gItems] = await pool.query(`
          SELECT gi.*, poi.purchase_price, poi.gst
          FROM grn_items gi
          LEFT JOIN purchase_order_items poi ON poi.purchase_order_id = ? AND poi.product_id = gi.product_id
          WHERE gi.grn_id = ?
        `, [uGrn.purchase_order_id, uGrn.grn_id]);

        let grnSubtotal = 0;
        let grnGst = 0;
        let grnTotal = 0;
        const itemsToAdd = [];

        for (const gi of gItems) {
          const qtyRec = Number(gi.quantity_received || 0);
          const qtyDam = Number(gi.quantity_damaged || 0);
          const qtyRej = Number(gi.quantity_rejected || 0);
          const netAcc = Math.max(0, qtyRec - qtyDam - qtyRej);
          if (netAcc <= 0) continue;

          const pp = Number(gi.purchase_price || 0);
          const gst = Number(gi.gst || 0);
          const sub = Number((netAcc * pp).toFixed(2));
          const tax = Number(((sub * gst) / 100).toFixed(2));
          const tot = Number((sub + tax).toFixed(2));

          grnSubtotal += sub;
          grnGst += tax;
          grnTotal += tot;

          itemsToAdd.push({
            product_id: gi.product_id,
            quantity: netAcc,
            purchase_price: pp,
            mrp: Number(gi.mrp || 0),
            gst: gst,
            total: tot
          });
        }

        if (grnTotal > 0) {
          if (existingPurch.length > 0) {
            const purchId = existingPurch[0].id;
            const newSub = Number((Number(existingPurch[0].subtotal || 0) + grnSubtotal).toFixed(2));
            const newTax = Number((Number(existingPurch[0].gst_amount || 0) + grnGst).toFixed(2));
            const newTot = Number((Number(existingPurch[0].total || 0) + grnTotal).toFixed(2));

            await pool.query(
              'UPDATE purchases SET grn_id = ?, subtotal = ?, gst_amount = ?, total = ? WHERE id = ?',
              [uGrn.grn_id, newSub, newTax, newTot, purchId]
            );

            for (const it of itemsToAdd) {
              await pool.query(
                `INSERT INTO purchase_items (purchase_id, product_id, quantity, purchase_price, mrp, gst, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [purchId, it.product_id, it.quantity, it.purchase_price, it.mrp, it.gst, it.total]
              );
            }
          } else {
            // Create new purchase
            const pYear = new Date(uGrn.date).getFullYear() || 2026;
            const [allPurchases] = await pool.query('SELECT purchase_no FROM purchases WHERE purchase_no LIKE ?', [`PUR-%-${pYear}`]);
            let maxPSeq = 0;
            for (const row of allPurchases) {
              if (row.purchase_no) {
                const parts = row.purchase_no.split('-');
                const seq = parseInt(parts[1], 10);
                if (!isNaN(seq) && seq > maxPSeq) maxPSeq = seq;
              }
            }
            const purchaseNo = `PUR-${String(maxPSeq + 1).padStart(4, '0')}-${pYear}`;

            const [pRes] = await pool.query(
              `INSERT INTO purchases (purchase_no, vendor_id, warehouse_id, date, subtotal, discount, gst_amount, total, paid_amount, payment_status, delivery_status, payment_method, purchase_order_id, grn_id)
               VALUES (?, ?, ?, ?, ?, 0.00, ?, ?, 0.00, 'Pending', 'Received', 'Credit', ?, ?)`,
              [purchaseNo, uGrn.vendor_id, uGrn.warehouse_id, uGrn.date, grnSubtotal, grnGst, grnTotal, uGrn.purchase_order_id, uGrn.grn_id]
            );
            const purchId = pRes.insertId;

            for (const it of itemsToAdd) {
              await pool.query(
                `INSERT INTO purchase_items (purchase_id, product_id, quantity, purchase_price, mrp, gst, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [purchId, it.product_id, it.quantity, it.purchase_price, it.mrp, it.gst, it.total]
              );
            }

            await pool.query(
              `INSERT INTO vendor_ledger (vendor_id, purchase_id, date, transaction_type, reference_no, description, debit_amount, credit_amount, running_balance)
               VALUES (?, ?, ?, 'PURCHASE_INVOICE', ?, ?, ?, 0.00, ?)`,
              [uGrn.vendor_id, purchId, uGrn.date, purchaseNo, `Purchase Invoice ${purchaseNo} (Auto-reconciled GRN: ${uGrn.grn_no})`, grnTotal, grnTotal]
            );
          }

          // Reconcile vendor totals
          const [invSum] = await pool.query('SELECT COALESCE(SUM(total), 0) as total FROM purchases WHERE vendor_id = ?', [uGrn.vendor_id]);
          const [retSum] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM purchase_returns WHERE vendor_id = ? AND (status IS NULL OR status != "Void")', [uGrn.vendor_id]);
          const [paySum] = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM supplier_payments WHERE vendor_id = ?', [uGrn.vendor_id]);
          const [vRow] = await pool.query('SELECT opening_balance, opening_balance_type FROM vendors WHERE id = ?', [uGrn.vendor_id]);
          if (vRow.length > 0) {
            const grossP = Number(invSum[0].total || 0);
            const retP = Number(retSum[0].total || 0);
            const netP = Math.max(0, grossP - retP);
            const openBal = vRow[0].opening_balance_type === 'Advance' ? -Number(vRow[0].opening_balance || 0) : Number(vRow[0].opening_balance || 0);
            const totPaid = Number(paySum[0].total || 0);
            const newBal = Math.max(0, (netP + openBal) - totPaid);
            await pool.query('UPDATE vendors SET total_purchases = ?, total_paid = ?, outstanding_balance = ? WHERE id = ?', [grossP, totPaid, newBal, uGrn.vendor_id]);
          }
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] unbilled GRN reconciliation check:', e.message);
    }

    // ── 10. AUTO-HEAL TENANT SETTINGS (REMOVE DUMMY/PLACEHOLDER DATA) ──
    try {
      const [tRows] = await pool.query('SELECT * FROM kirana_erp_master.tenants WHERE database_name = DATABASE()');
      if (tRows.length > 0) {
        const tenant = tRows[0];
        const [settingsRows] = await pool.query('SELECT `key`, `value` FROM settings');
        const currentSettings = {};
        for (const s of settingsRows) {
          currentSettings[s.key] = s.value;
        }

        const isDummyAddress = (addr) => {
          if (!addr) return true;
          const s = String(addr).toLowerCase().trim();
          return s === '' || s.includes('enter store address') || s.includes('malviya nagar') || s.includes('main commercial market') || s.includes('main market, city center');
        };

        const isDummyPhone = (p) => {
          if (!p) return true;
          const s = String(p).replace(/\D/g, '');
          return s === '' || s === '0000000000' || s === '00000000' || s.startsWith('000000') || s === '9876543210' || s === '9812345678';
        };

        const isDummyGstin = (g) => {
          if (!g) return true;
          const s = String(g).trim().toUpperCase();
          return s === '' || s === '07AAAAA1111A1Z1' || s === '07BBBCC2222B2Z2' || s === '000000000000000' || s.startsWith('000000');
        };

        // Real Address
        const realAddress = (!isDummyAddress(tenant.address)) ? tenant.address : (!isDummyAddress(currentSettings.store_address) ? currentSettings.store_address : '');
        if (isDummyAddress(currentSettings.store_address) || currentSettings.store_address !== realAddress) {
          await pool.query(
            'INSERT INTO settings (`key`, `value`) VALUES ("store_address", ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [realAddress, realAddress]
          );
        }

        // Real Phone
        const realPhone = (!isDummyPhone(tenant.phone)) ? tenant.phone : (!isDummyPhone(currentSettings.store_phone) ? currentSettings.store_phone : '');
        if (isDummyPhone(currentSettings.store_phone) || (realPhone && currentSettings.store_phone !== realPhone)) {
          await pool.query(
            'INSERT INTO settings (`key`, `value`) VALUES ("store_phone", ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [realPhone, realPhone]
          );
        }

        // Real GSTIN
        const realGstin = (!isDummyGstin(tenant.gstin)) ? tenant.gstin : (!isDummyGstin(currentSettings.gstin) ? currentSettings.gstin : '');
        if (isDummyGstin(currentSettings.gstin) || (realGstin && currentSettings.gstin !== realGstin)) {
          await pool.query(
            'INSERT INTO settings (`key`, `value`) VALUES ("gstin", ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [realGstin, realGstin]
          );
        }

        // Real Store Name
        if (tenant.store_name && (!currentSettings.store_name || currentSettings.store_name === 'KIRANA MART ERP' || currentSettings.store_name === 'Kirana Mart Enterprise')) {
          await pool.query(
            'INSERT INTO settings (`key`, `value`) VALUES ("store_name", ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [tenant.store_name, tenant.store_name]
          );
        }

        // Real Store Logo & Auto-Heal Missing/Deleted Files
        const logoCandidates = [
          currentSettings.store_logo,
          currentSettings.logo_url,
          tenant.logo_url
        ].filter(Boolean);

        const checkFileExists = (urlPath) => {
          if (!urlPath || typeof urlPath !== 'string') return false;
          const clean = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
          return fs.existsSync(path.join(process.cwd(), clean));
        };

        let activeLogoOnDisk = null;
        for (const candidate of logoCandidates) {
          if (checkFileExists(candidate)) {
            activeLogoOnDisk = candidate;
            break;
          }
        }

        // If candidate logo files do not exist on disk, scan tenant logo folder for the latest valid image
        if (!activeLogoOnDisk && tenant.database_name) {
          const tenantLogosDir = path.join(process.cwd(), 'uploads', 'tenants', tenant.database_name, 'logos');
          if (fs.existsSync(tenantLogosDir)) {
            const files = fs.readdirSync(tenantLogosDir).filter(f => !f.startsWith('.'));
            if (files.length > 0) {
              files.sort((a, b) => fs.statSync(path.join(tenantLogosDir, b)).mtimeMs - fs.statSync(path.join(tenantLogosDir, a)).mtimeMs);
              activeLogoOnDisk = `/uploads/tenants/${tenant.database_name}/logos/${files[0]}`;
            }
          }
        }

        if (activeLogoOnDisk) {
          if (currentSettings.store_logo !== activeLogoOnDisk) {
            await pool.query(
              'INSERT INTO settings (`key`, `value`) VALUES ("store_logo", ?) ON DUPLICATE KEY UPDATE `value` = ?',
              [activeLogoOnDisk, activeLogoOnDisk]
            );
          }
          if (currentSettings.logo_url !== activeLogoOnDisk) {
            await pool.query(
              'INSERT INTO settings (`key`, `value`) VALUES ("logo_url", ?) ON DUPLICATE KEY UPDATE `value` = ?',
              [activeLogoOnDisk, activeLogoOnDisk]
            );
          }
          if (tenant.logo_url !== activeLogoOnDisk) {
            await pool.query(
              'UPDATE kirana_erp_master.tenants SET logo_url = ? WHERE id = ?',
              [activeLogoOnDisk, tenant.id]
            );
          }
        } else {
          // If no valid logo exists on disk, clean up orphaned references
          if (currentSettings.store_logo || currentSettings.logo_url) {
            await pool.query('DELETE FROM settings WHERE `key` IN ("store_logo", "logo_url")');
          }
          if (tenant.logo_url) {
            await pool.query('UPDATE kirana_erp_master.tenants SET logo_url = NULL WHERE id = ?', [tenant.id]);
          }
        }
      }
    } catch (e) {
      console.warn('[Schema Migration] settings auto-heal check:', e.message);
    }
  } catch (err) {
    console.error('[Schema Migration] Category schema migration notice:', err.message);
  }
};
