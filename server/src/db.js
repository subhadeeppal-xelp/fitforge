const mysql = require('mysql2/promise');

let pool;

function buildPoolFromUrl(url) {
  return mysql.createPool(url + (url.includes('?') ? '&' : '?') + 'multipleStatements=false');
}

function getPool() {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    pool = buildPoolFromUrl(process.env.DATABASE_URL);
  } else {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true,
    });
  }
  return pool;
}

module.exports = { getPool };
