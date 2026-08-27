const mysql = require('mysql2/promise');
const { URL } = require('url');

let pool;

// Parses a mysql:// connection string into a mysql2 pool config, handling
// SSL params (like Aiven's ssl-mode=REQUIRED) that mysql2 doesn't understand
// natively when left in the URL — mysql2 warns and ignores them, and a future
// version will throw instead. We pull ssl-mode/sslmode out and translate it
// into mysql2's own `ssl` option.
function poolConfigFromUrl(rawUrl) {
  const u = new URL(rawUrl);
  const params = u.searchParams;

  const sslMode = (params.get('ssl-mode') || params.get('sslmode') || '').toUpperCase();
  // REQUIRED (Aiven's default) means "encrypt, but don't verify the cert chain".
  // For full certificate verification instead, download the provider's CA cert
  // and pass it as `ssl: { ca: fs.readFileSync(...), rejectUnauthorized: true }`.
  const ssl = sslMode ? { rejectUnauthorized: false } : undefined;

  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
  };
}

function getPool() {
  if (pool) return pool;

  if (process.env.DATABASE_URL) {
    pool = mysql.createPool(poolConfigFromUrl(process.env.DATABASE_URL));
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
