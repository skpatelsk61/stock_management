import mysql from 'mysql2/promise';

async function checkMasterUsers() {
  const config = {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'kirana_erp_master'
  };

  const connection = await mysql.createConnection(config);
  const [users] = await connection.query('SELECT * FROM users');
  console.log('Master Users:', users);
  await connection.end();
}

checkMasterUsers().catch(console.error);
