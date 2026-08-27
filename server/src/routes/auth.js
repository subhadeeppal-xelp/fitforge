const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db');
const { signToken } = require('../utils/jwt');
const { sendVerificationEmail, genCode } = require('../utils/mailer');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
router.use(authLimiter);

function ttlMinutes() {
  return Number(process.env.VERIFICATION_CODE_TTL_MIN || 15);
}

async function createAndSendCode(pool, userId, email, fullName) {
  const code = genCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + ttlMinutes() * 60000);
  await pool.query('DELETE FROM email_verifications WHERE user_id = ?', [userId]);
  await pool.query(
    'INSERT INTO email_verifications (user_id, code_hash, expires_at) VALUES (?, ?, ?)',
    [userId, codeHash, expiresAt]
  );
  await sendVerificationEmail(email, fullName, code);
}

// ---------- POST /api/auth/signup ----------
router.post('/signup', async (req, res) => {
  try {
    const { username, fullName, email, password } = req.body || {};
    if (!username || !fullName || !email || !password) {
      return res.status(400).json({ error: 'username, fullName, email and password are all required.' });
    }
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-32 characters: letters, numbers, underscore only.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const pool = getPool();
    const [existing] = await pool.query(
      'SELECT id, is_verified FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existing.length) {
      const row = existing[0];
      if (row.is_verified) {
        return res.status(409).json({ error: 'That username or email is already registered.' });
      }
      // Unverified duplicate signup attempt — resend a fresh code instead of erroring out.
      await createAndSendCode(pool, row.id, email, fullName);
      return res.status(200).json({
        message: 'An account already exists but is unverified. A new verification code was sent.',
        email,
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (username, full_name, email, password_hash, is_verified) VALUES (?, ?, ?, ?, 0)',
      [username, fullName, email, passwordHash]
    );
    const userId = result.insertId;
    await pool.query('INSERT INTO leaderboard (user_id, points) VALUES (?, 0)', [userId]);
    await createAndSendCode(pool, userId, email, fullName);

    return res.status(201).json({
      message: 'Account created. Check your email for a verification code.',
      email,
    });
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

// ---------- POST /api/auth/verify-email ----------
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required.' });
    }
    const pool = getPool();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(404).json({ error: 'No account found for that email.' });
    const user = users[0];

    if (user.is_verified) {
      const token = signToken(user);
      return res.status(200).json({ message: 'Already verified.', token, user: publicUser(user) });
    }

    const [rows] = await pool.query(
      'SELECT * FROM email_verifications WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      [user.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'No pending verification. Request a new code.' });
    const verification = rows[0];

    if (new Date(verification.expires_at) < new Date()) {
      return res.status(400).json({ error: 'That code has expired. Request a new one.' });
    }
    if (verification.attempts >= 5) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    const match = await bcrypt.compare(String(code), verification.code_hash);
    if (!match) {
      await pool.query('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?', [verification.id]);
      return res.status(400).json({ error: 'Incorrect code.' });
    }

    await pool.query('UPDATE users SET is_verified = 1 WHERE id = ?', [user.id]);
    await pool.query('DELETE FROM email_verifications WHERE user_id = ?', [user.id]);
    user.is_verified = 1;

    const token = signToken(user);
    return res.status(200).json({ message: 'Email verified.', token, user: publicUser(user) });
  } catch (err) {
    console.error('verify-email error', err);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// ---------- POST /api/auth/resend-code ----------
router.post('/resend-code', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email is required.' });
    const pool = getPool();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(404).json({ error: 'No account found for that email.' });
    const user = users[0];
    if (user.is_verified) return res.status(400).json({ error: 'Account is already verified.' });
    await createAndSendCode(pool, user.id, user.email, user.full_name);
    return res.status(200).json({ message: 'A new verification code was sent.' });
  } catch (err) {
    console.error('resend-code error', err);
    return res.status(500).json({ error: 'Could not resend code. Please try again.' });
  }
});

// ---------- POST /api/auth/login ----------
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required.' });
    }
    const pool = getPool();
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );
    if (!users.length) return res.status(401).json({ error: 'Wrong username or password.' });
    const user = users[0];

    const match = await bcrypt.compare(String(password), user.password_hash);
    if (!match) return res.status(401).json({ error: 'Wrong username or password.' });

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Email not verified.', needsVerification: true, email: user.email });
    }

    const token = signToken(user);
    return res.status(200).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ---------- GET /api/auth/me ----------
router.get('/me', requireAuth, async (req, res) => {
  const pool = getPool();
  const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!users.length) return res.status(404).json({ error: 'User not found.' });
  return res.status(200).json({ user: publicUser(users[0]) });
});

function publicUser(u) {
  return { id: u.id, username: u.username, fullName: u.full_name, email: u.email, isVerified: !!u.is_verified };
}

module.exports = router;
