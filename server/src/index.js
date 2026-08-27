require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');

const app = express();

// Render (and most PaaS) sit behind a reverse proxy that sets X-Forwarded-For.
// Without this, express-rate-limit can't safely identify per-IP clients and
// throws on every request instead of just rate-limiting.
app.set('trust proxy', 1);

// Render (and most PaaS hosts) sit behind a reverse proxy and set
// X-Forwarded-For. Without this, express-rate-limit throws on every
// request instead of rate-limiting correctly.
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim().replace(/\/+$/, '')) // strip trailing slash(es) — Origin headers never include one
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`FitForge API listening on port ${PORT}`));
