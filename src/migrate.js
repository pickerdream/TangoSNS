const path = require('path');

async function runMigrations() {
  const { runner } = await import('node-pg-migrate');
  const databaseUrl = `postgres://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;

  console.log('マイグレーション実行中...');
  await runner({
    databaseUrl,
    dir: path.join(__dirname, '../migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    count: Infinity,
    verbose: false,
  });
  console.log('マイグレーション完了');
}

module.exports = { runMigrations };
