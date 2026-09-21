import mysql from 'mysql2/promise';

async function checkUserCols() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: ''
  });

  const [dbs] = await connection.query("SHOW DATABASES LIKE 'shop_%'");
  for (const dbRow of dbs) {
    const dbName = Object.values(dbRow)[0];
    console.log(`\n=== Columns in ${dbName}.users ===`);
    const [cols] = await connection.query(`SHOW COLUMNS FROM \`${dbName}\`.users`);
    console.log(cols.map(c => c.Field));
  }
  await connection.end();
}

checkUserCols().catch(console.error);
