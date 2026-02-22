require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

async function checkConnection() {
  try {
    await client.connect();
    console.log('データベースへの接続に成功しました。');
    const res = await client.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' 
      AND schemaname != 'information_schema'
    `);
    console.log('テーブル一覧:');
    res.rows.forEach(row => {
      console.log(`- ${row.tablename}`);
    });
  } catch (err) {
    console.error('データベースへの接続に失敗しました。エラー:', err);
  } finally {
    await client.end();
  }
}

checkConnection();
