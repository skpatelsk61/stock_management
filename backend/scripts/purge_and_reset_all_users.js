import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 3306
};

async function purgeAndResetAllUsers() {
  console.log('\n======================================================');
  console.log('   PERMANENT PURGE OF ALL USERS & TENANT RESET TO 1   ');
  console.log('======================================================\n');

  let connection;

  try {
    connection = await mysql.createConnection({ ...dbConfig, database: 'kirana_erp_master' });
    console.log('[1/5] Connected to master database: kirana_erp_master');

    // 1. Collect all tenant databases to drop
    const [tenantRows] = await connection.query('SELECT id, store_name, database_name FROM tenants');
    const tenantDbsToDrop = new Set(tenantRows.map(t => t.database_name).filter(Boolean));

    // Also include legacy / test databases that should be cleaned
    const legacyDbs = ['shop_aman001', 'shop_vinay001', 'shop_ajay001', 'dinesh01', 'deepesh04'];
    legacyDbs.forEach(db => tenantDbsToDrop.add(db));

    console.log(`[2/5] Dropping ${tenantDbsToDrop.size} tenant database(s)...`);
    for (const dbName of tenantDbsToDrop) {
      try {
        await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        console.log(`  ✓ Dropped database: \`${dbName}\``);
      } catch (err) {
        console.warn(`  ! Could not drop database \`${dbName}\`: ${err.message}`);
      }
    }

    // 2. Disable foreign key checks for clean truncation/deletion
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    console.log('\n[3/5] Cleaning master database tables...');

    // Clear logs, notifications, billing, subscriptions
    const masterTablesToClear = [
      'activity_logs',
      'notifications',
      'billing_history',
      'subscriptions',
      'subscription_logs'
    ];

    for (const tableName of masterTablesToClear) {
      try {
        const [delRes] = await connection.query(`DELETE FROM \`${tableName}\``);
        await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
        console.log(`  ✓ Emptied table \`${tableName}\` (${delRes.affectedRows} rows deleted, AUTO_INCREMENT = 1)`);
      } catch (err) {
        console.warn(`  ! Error clearing table \`${tableName}\`: ${err.message}`);
      }
    }

    // Delete all users except Super Admin
    const [delUsers] = await connection.query(
      `DELETE FROM users WHERE role != 'Super Admin' OR tenant_id IS NOT NULL`
    );
    console.log(`  ✓ Deleted ${delUsers.affectedRows} non-superadmin user(s) from \`users\` table`);

    // Verify Super Admin exists
    const [superAdmins] = await connection.query(
      `SELECT id, email, login_id, role, status FROM users WHERE role = 'Super Admin'`
    );
    if (superAdmins.length === 0) {
      console.log('  ! Super Admin missing, re-creating default platform Super Admin...');
      const bcrypt = await import('bcryptjs');
      const salt = await bcrypt.default.genSalt(10);
      const hash = await bcrypt.default.hash('superadminpassword', salt);
      await connection.query(
        `INSERT INTO users (id, tenant_id, email, login_id, password, role, status)
         VALUES (1, NULL, 'superadmin@kiranamart.com', 'superadmin', ?, 'Super Admin', 'Active')`,
        [hash]
      );
      console.log('  ✓ Created Super Admin (id = 1, email: superadmin@kiranamart.com)');
    } else {
      console.log(`  ✓ Super Admin retained: ${superAdmins[0].email} (ID: ${superAdmins[0].id})`);
    }

    // Reset users table auto_increment so next created user starts sequentially
    await connection.query('ALTER TABLE users AUTO_INCREMENT = 2');
    console.log('  ✓ Set `users` table AUTO_INCREMENT = 2');

    // Delete all tenants
    const [delTenants] = await connection.query('DELETE FROM tenants');
    console.log(`  ✓ Deleted ${delTenants.affectedRows} tenant(s) from \`tenants\` table`);

    // Reset tenants AUTO_INCREMENT to 1
    await connection.query('ALTER TABLE tenants AUTO_INCREMENT = 1');
    console.log('  ✓ Set `tenants` table AUTO_INCREMENT = 1 (NEXT TENANT CREATED WILL HAVE ID = 1)');

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    // 3. Purge physical storage/uploads
    console.log('\n[4/5] Purging physical storage and uploaded assets...');
    const tenantUploadsDir = path.join(__dirname, '../uploads/tenants');
    if (fs.existsSync(tenantUploadsDir)) {
      const tenantFolders = fs.readdirSync(tenantUploadsDir);
      for (const folder of tenantFolders) {
        const folderPath = path.join(tenantUploadsDir, folder);
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.log(`  ✓ Removed tenant folder: uploads/tenants/${folder}`);
        } catch (err) {
          console.warn(`  ! Could not delete ${folderPath}: ${err.message}`);
        }
      }
    }

    const logosDir = path.join(__dirname, '../uploads/logos');
    if (fs.existsSync(logosDir)) {
      const logoFiles = fs.readdirSync(logosDir);
      for (const file of logoFiles) {
        const filePath = path.join(logosDir, file);
        try {
          fs.rmSync(filePath, { force: true });
          console.log(`  ✓ Removed logo file: uploads/logos/${file}`);
        } catch (err) {
          console.warn(`  ! Could not delete ${filePath}: ${err.message}`);
        }
      }
    }

    // 4. Verification Summary
    console.log('\n[5/5] Final Verification State:');
    const [remainingTenants] = await connection.query('SELECT * FROM tenants');
    const [remainingUsers] = await connection.query('SELECT id, tenant_id, email, login_id, role, status FROM users');
    const [[tenantAiRow]] = await connection.query(
      `SELECT AUTO_INCREMENT 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = 'kirana_erp_master' AND TABLE_NAME = 'tenants'`
    );

    console.log('\n--- Tenants in Master DB (Total: ' + remainingTenants.length + ') ---');
    console.table(remainingTenants);

    console.log('--- Next Tenant Auto-Increment Value ---');
    console.log(`tenants.AUTO_INCREMENT = ${tenantAiRow.AUTO_INCREMENT}`);

    console.log('\n--- Users in Master DB (Total: ' + remainingUsers.length + ') ---');
    console.table(remainingUsers);

    console.log('\n======================================================');
    console.log('   PURGE COMPLETED SUCCESSFULLY!                      ');
    console.log('   ANY NEW STORE/USER WILL NOW START WITH TENANT ID 1 ');
    console.log('======================================================\n');

  } catch (error) {
    console.error('[ERROR] Purge failed:', error);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

purgeAndResetAllUsers();
