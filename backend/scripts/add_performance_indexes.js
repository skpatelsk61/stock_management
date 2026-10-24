import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export async function addPerformanceIndexes() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const masterDb = 'kirana_erp_master';

  console.log('[Index Optimizer] Connecting to Master DB...');
  const masterConn = await mysql.createConnection({ host, port, user, password, database: masterDb });

  const addIndexIfTableExists = async (conn, dbName, table, indexName, columnsSql) => {
    try {
      const [tableExists] = await conn.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [dbName, table]
      );
      if (tableExists.length === 0) return;

      const [existing] = await conn.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [dbName, table, indexName]
      );
      if (existing.length === 0) {
        console.log(`  [${dbName}] Adding index "${indexName}" on "${table}" (${columnsSql})...`);
        await conn.query(`CREATE INDEX \`${indexName}\` ON \`${table}\` (${columnsSql})`);
      }
    } catch (err) {
      console.warn(`  [${dbName}] Index notice for ${table}.${indexName}:`, err.message);
    }
  };

  try {
    // 1. Optimize Master DB
    console.log('[Index Optimizer] Optimizing Master DB indexes...');
    await addIndexIfTableExists(masterConn, masterDb, 'users', 'idx_users_email', 'email');
    await addIndexIfTableExists(masterConn, masterDb, 'users', 'idx_users_login_id', 'login_id');
    await addIndexIfTableExists(masterConn, masterDb, 'users', 'idx_users_tenant_role', 'tenant_id, role');
    await addIndexIfTableExists(masterConn, masterDb, 'tenants', 'idx_tenants_email', 'email');
    await addIndexIfTableExists(masterConn, masterDb, 'notifications', 'idx_master_notif_created', 'created_at');
    await addIndexIfTableExists(masterConn, masterDb, 'activity_logs', 'idx_master_logs_created', 'created_at');

    // 2. Discover existing databases
    const [allDbs] = await masterConn.query('SHOW DATABASES');
    const dbSet = new Set(allDbs.map(d => Object.values(d)[0]));

    // 3. Optimize each tenant database
    const [tenants] = await masterConn.query('SELECT id, store_name, database_name FROM tenants');
    for (const tenant of tenants) {
      const dbName = tenant.database_name;
      if (!dbName || !dbSet.has(dbName)) {
        console.log(`[Index Optimizer] Skipping missing database: "${dbName}"`);
        continue;
      }

      console.log(`[Index Optimizer] Optimizing indexes for tenant: "${dbName}"...`);
      let tenantConn;
      try {
        tenantConn = await mysql.createConnection({ host, port, user, password, database: dbName });

        // Sales & Sale Items
        await addIndexIfTableExists(tenantConn, dbName, 'sales', 'idx_sales_date', 'date');
        await addIndexIfTableExists(tenantConn, dbName, 'sales', 'idx_sales_customer', 'customer_id');
        await addIndexIfTableExists(tenantConn, dbName, 'sales', 'idx_sales_created', 'created_at');
        await addIndexIfTableExists(tenantConn, dbName, 'sales', 'idx_sales_payment_status', 'payment_status');
        await addIndexIfTableExists(tenantConn, dbName, 'sale_items', 'idx_sale_items_sale', 'sale_id');
        await addIndexIfTableExists(tenantConn, dbName, 'sale_items', 'idx_sale_items_product', 'product_id');
        await addIndexIfTableExists(tenantConn, dbName, 'sale_items', 'idx_sale_items_composite', 'sale_id, product_id');

        // Purchases & Purchase Items
        await addIndexIfTableExists(tenantConn, dbName, 'purchases', 'idx_purchases_date', 'date');
        await addIndexIfTableExists(tenantConn, dbName, 'purchases', 'idx_purchases_vendor', 'vendor_id');
        await addIndexIfTableExists(tenantConn, dbName, 'purchases', 'idx_purchases_created', 'created_at');
        await addIndexIfTableExists(tenantConn, dbName, 'purchase_items', 'idx_purchase_items_purchase', 'purchase_id');
        await addIndexIfTableExists(tenantConn, dbName, 'purchase_items', 'idx_purchase_items_product', 'product_id');
        await addIndexIfTableExists(tenantConn, dbName, 'purchase_items', 'idx_purchase_items_composite', 'purchase_id, product_id');

        // Batches & GRN
        await addIndexIfTableExists(tenantConn, dbName, 'purchase_batches', 'idx_batches_lookup', 'product_id, remaining_quantity, expiry_date');
        await addIndexIfTableExists(tenantConn, dbName, 'purchase_batches', 'idx_batches_fifo', 'product_id, remaining_quantity, purchase_date, id');
        await addIndexIfTableExists(tenantConn, dbName, 'grn_items', 'idx_grn_items_lookup', 'product_id, mrp, expiry_date');

        // Products
        await addIndexIfTableExists(tenantConn, dbName, 'products', 'idx_products_barcode', 'barcode');
        await addIndexIfTableExists(tenantConn, dbName, 'products', 'idx_products_sku', 'sku');
        await addIndexIfTableExists(tenantConn, dbName, 'products', 'idx_products_category', 'category_id');
        await addIndexIfTableExists(tenantConn, dbName, 'products', 'idx_products_sub_category', 'sub_category_id');
        await addIndexIfTableExists(tenantConn, dbName, 'products', 'idx_products_brand', 'brand_id');
        await addIndexIfTableExists(tenantConn, dbName, 'products', 'idx_products_name', 'name(100)');

        // Stock
        await addIndexIfTableExists(tenantConn, dbName, 'stock', 'idx_stock_product_wh', 'product_id, warehouse_id');

        // Notifications
        await addIndexIfTableExists(tenantConn, dbName, 'notifications', 'idx_tenant_notif_created', 'created_at');
        await addIndexIfTableExists(tenantConn, dbName, 'notifications', 'idx_tenant_notif_read', 'is_read, created_at');
        await addIndexIfTableExists(tenantConn, dbName, 'notifications', 'idx_tenant_notif_module', 'module');

        // Activity Logs
        await addIndexIfTableExists(tenantConn, dbName, 'activity_logs', 'idx_tenant_logs_created', 'created_at');
        await addIndexIfTableExists(tenantConn, dbName, 'activity_logs', 'idx_tenant_logs_user', 'user_id, created_at');

        // Customers & Vendors
        await addIndexIfTableExists(tenantConn, dbName, 'customers', 'idx_cust_phone', 'phone');
        await addIndexIfTableExists(tenantConn, dbName, 'customers', 'idx_cust_name', 'name(100)');
        await addIndexIfTableExists(tenantConn, dbName, 'customers', 'idx_cust_type', 'customer_type');
        await addIndexIfTableExists(tenantConn, dbName, 'vendors', 'idx_vendor_phone', 'phone');
        await addIndexIfTableExists(tenantConn, dbName, 'vendors', 'idx_vendor_name', 'name(100)');

        console.log(`  ✓ Tenant "${dbName}" indexes verified/added.`);
      } catch (err) {
        console.error(`  ✕ Error on tenant "${dbName}":`, err.message);
      } finally {
        if (tenantConn) await tenantConn.end();
      }
    }

    console.log('\n[Index Optimizer] Completed successfully!');
  } finally {
    await masterConn.end();
  }
}

addPerformanceIndexes();
