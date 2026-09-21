import mysql from 'mysql2/promise';

async function seedMissingWalkInCustomers() {
  const config = {
    host: 'localhost',
    user: 'root',
    password: ''
  };

  const connection = await mysql.createConnection(config);
  const [dbs] = await connection.query("SHOW DATABASES LIKE 'shop_%'");

  for (const dbRow of dbs) {
    const dbName = Object.values(dbRow)[0];
    console.log(`\n--- Inspecting Database: ${dbName} ---`);
    await connection.query(`USE \`${dbName}\``);

    // Check customers
    const [custRows] = await connection.query('SELECT id, name, customer_type FROM customers');
    console.log(`Customers in ${dbName}:`, custRows);

    if (custRows.length === 0) {
      console.log(`Seeding default Walk-in Customer for ${dbName}...`);
      await connection.query(
        `INSERT INTO customers (id, customer_code, name, phone, email, customer_type, status, created_by)
         VALUES (1, 'CUST-00001', 'Walk-in Customer', '', '', 'Walk-in', 'Active', 1)
         ON DUPLICATE KEY UPDATE name='Walk-in Customer'`
      );
      console.log(`Successfully seeded Walk-in Customer for ${dbName}`);
    }

    // Check warehouses
    const [whRows] = await connection.query('SELECT id, name FROM warehouses');
    console.log(`Warehouses in ${dbName}:`, whRows);
    if (whRows.length === 0) {
      console.log(`Seeding default Warehouse for ${dbName}...`);
      await connection.query(
        `INSERT INTO warehouses (id, name, location, is_active)
         VALUES (1, 'Main Storage', 'Default Warehouse', 1)
         ON DUPLICATE KEY UPDATE name='Main Storage'`
      );
    }
  }

  await connection.end();
}

seedMissingWalkInCustomers().catch(console.error);
