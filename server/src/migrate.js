require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');

async function migrate() {
  const pool = getPool();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // Split on semicolons that end a statement (schema.sql has no semicolons inside strings)
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log(`Migration complete — ${statements.length} statements applied.`);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
