const express = require('express');
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_KEYS = new Set([
  'activities', 'junk', 'routine', 'routineLog',
  'water', 'weight', 'goals', 'settings',
]);

// ---------- GET /api/data ----------
// Returns every stored data_key for the logged-in user as one object,
// e.g. { activities: [...], junk: [...], ... }
router.get('/', async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    'SELECT data_key, data_value FROM user_data WHERE user_id = ?',
    [req.userId]
  );
  const out = {};
  for (const row of rows) {
    try { out[row.data_key] = JSON.parse(row.data_value); }
    catch { out[row.data_key] = null; }
  }
  return res.status(200).json({ data: out });
});

// ---------- PUT /api/data/:key ----------
// Body: { value: <any JSON> } — upserts one key for the logged-in user.
router.put('/:key', async (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(400).json({ error: `Unknown data key: ${key}` });
  }
  const value = JSON.stringify(req.body?.value ?? null);
  const pool = getPool();
  await pool.query(
    `INSERT INTO user_data (user_id, data_key, data_value) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE data_value = VALUES(data_value)`,
    [req.userId, key, value]
  );
  return res.status(200).json({ ok: true });
});

// ---------- GET /api/data/leaderboard ----------
router.get('/leaderboard/all', async (req, res) => {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT u.username, l.points FROM leaderboard l
     JOIN users u ON u.id = l.user_id
     ORDER BY l.points DESC LIMIT 100`
  );
  return res.status(200).json({ leaderboard: rows });
});

// ---------- POST /api/data/leaderboard/points ----------
// Body: { delta: <int> } — adds delta to the logged-in user's points.
router.post('/leaderboard/points', async (req, res) => {
  const delta = Number(req.body?.delta);
  if (!Number.isFinite(delta)) return res.status(400).json({ error: 'delta must be a number.' });
  const pool = getPool();
  await pool.query(
    `INSERT INTO leaderboard (user_id, points) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE points = points + VALUES(points)`,
    [req.userId, delta]
  );
  const [rows] = await pool.query('SELECT points FROM leaderboard WHERE user_id = ?', [req.userId]);
  return res.status(200).json({ points: rows[0]?.points ?? 0 });
});

module.exports = router;
