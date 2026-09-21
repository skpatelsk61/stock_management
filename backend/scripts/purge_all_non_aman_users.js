import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function purgeNonAmanUsersAndTenants() {
  console.log('\n======================================================');
  console.log('PURGING ALL TENANTS AND USERS EXCEPT AMAN KIRANA MART');
  console.log('======================================================\n');

  const masterDb = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'kirana_erp_master'
  });

  try {
    // 1. Fetch all tenants from master DB
    const [allTenants] = await masterDb.query('SELECT id, store_name, owner_name, email, database_name FROM tenants');
    console.log(`Total tenants found in master DB: ${allTenants.length}`);

    // Filter tenants to purge (keep tenant_id = 1 / Aman Kirana Mart)
    const tenantsToPurge = allTenants.filter(t => t.id !== 1 && t.store_name !== 'Aman Kirana Mart');
    console.log(`Found ${tenantsToPurge.length} tenant(s) to purge:`);
    tenantsToPurge.forEach(t => console.log(` - ID ${t.id}: "${t.store_name}" (DB: ${t.database_name}, Email: ${t.email})`));

    if (tenantsToPurge.length === 0) {
      console.log('\nNo tenants to purge.');
    } else {
      const tenantIdsToPurge = tenantsToPurge.map(t => t.id);

      // 2. Clean up master DB references
      console.log('\nCleaning up master database records...');

      const [delLogs] = await masterDb.query('DELETE FROM activity_logs WHERE tenant_id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delLogs.affectedRows} activity_logs record(s).`);

      const [delNotifs] = await masterDb.query('DELETE FROM notifications WHERE tenant_id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delNotifs.affectedRows} notifications record(s).`);

      const [delSubLogs] = await masterDb.query('DELETE FROM subscription_logs WHERE tenant_id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delSubLogs.affectedRows} subscription_logs record(s).`);

      const [delSubs] = await masterDb.query('DELETE FROM subscriptions WHERE tenant_id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delSubs.affectedRows} subscriptions record(s).`);

      const [delBilling] = await masterDb.query('DELETE FROM billing_history WHERE tenant_id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delBilling.affectedRows} billing_history record(s).`);

      const [delUsers] = await masterDb.query('DELETE FROM users WHERE tenant_id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delUsers.affectedRows} user(s) from kirana_erp_master.users.`);

      const [delTenants] = await masterDb.query('DELETE FROM tenants WHERE id IN (?)', [tenantIdsToPurge]);
      console.log(` [✓] Deleted ${delTenants.affectedRows} tenant(s) from kirana_erp_master.tenants.`);

      // 3. Drop MySQL databases for purged tenants
      console.log('\nDropping tenant MySQL databases...');
      for (const tenant of tenantsToPurge) {
        if (tenant.database_name && tenant.database_name !== 'shop_aman001') {
          try {
            await masterDb.query(`DROP DATABASE IF EXISTS \`${tenant.database_name}\`;`);
            console.log(` [✓] Dropped database "${tenant.database_name}".`);
          } catch (err) {
            console.warn(` [!] Failed to drop database "${tenant.database_name}": ${err.message}`);
          }
        }
      }

      // 4. Remove upload directories for purged tenants
      console.log('\nCleaning up tenant upload folders...');
      for (const tenant of tenantsToPurge) {
        if (tenant.database_name) {
          const tenantUploadDir = path.resolve('uploads/tenants', tenant.database_name);
          if (fs.existsSync(tenantUploadDir)) {
            try {
              fs.rmSync(tenantUploadDir, { recursive: true, force: true });
              console.log(` [✓] Removed directory: ${tenantUploadDir}`);
            } catch (err) {
              console.warn(` [!] Failed to remove directory ${tenantUploadDir}: ${err.message}`);
            }
          }
        }
      }
    }

    // 5. Reset AUTO_INCREMENT on all master tables so next tenant ID starts sequentially
    console.log('\nResetting AUTO_INCREMENT sequence on master database tables...');
    const [tables] = await masterDb.query('SHOW TABLES');
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [maxIdRes] = await masterDb.query(`SELECT MAX(id) as max_id FROM \`${tableName}\``);
      const nextVal = (maxIdRes[0].max_id || 0) + 1;
      await masterDb.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = ${nextVal}`);
      console.log(` [✓] ${tableName} AUTO_INCREMENT set to ${nextVal}`);
    }

    // 6. Output remaining tenants and users summary
    const [remainingTenants] = await masterDb.query('SELECT id, store_name, owner_name, email, database_name FROM tenants');
    const [remainingUsers] = await masterDb.query('SELECT id, tenant_id, email, login_id, role FROM users');

    console.log('\n======================================================');
    console.log('REMAINING TENANTS IN MASTER DB:');
    console.table(remainingTenants);
    console.log('\nREMAINING USERS IN MASTER DB:');
    console.table(remainingUsers);
    console.log('======================================================\n');

  } catch (err) {
    console.error('Error during purge execution:', err);
  } finally {
    await masterDb.end();
  }
}

purgeNonAmanUsersAndTenants();
