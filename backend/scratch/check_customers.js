import mysql from 'mysql2/promise';

async function checkCustomers() {
  const config = {
    host: 'localhost',
    user: 'root',
    password: ''
  };

  const connection = await mysql.createConnection(config);
  
  console.log('=== Checking shop_hariom001.customers ===');
  await connection.query('USE shop_hariom001');
  const [hariomCust] = await connection.query('SELECT id, name, customer_code, customer_type FROM customers');
  console.log('Hariom Customers:', hariomCust);

  console.log('\n=== Checking shop_aman001.customers ===');
  await connection.query('USE shop_aman001');
  const [amanCust] = await connection.query('SELECT id, name, customer_code, customer_type FROM customers');
  console.log('Aman Customers:', amanCust);

  await connection.end();
}

checkCustomers().catch(console.error);
