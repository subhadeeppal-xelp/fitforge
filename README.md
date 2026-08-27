# FitForge — Full-Stack Setup Guide

This package has two parts:

```
frontend/   the FitForge PWA (static HTML/JS/CSS) — now calls a real backend
server/     Node.js + Express + MySQL + JWT + Gmail SMTP backend
```

What changed from the original single-file demo:
- Real accounts: **username, full name, email, password** — passwords are hashed with bcrypt, never stored in plain text.
- **Email verification**: signup sends a 6-digit code via Gmail SMTP; login is blocked until the email is verified.
- **JWT auth**: login/verify returns a signed token, stored in the browser and sent as `Authorization: Bearer <token>` on every request.
- **MySQL** stores users, verification codes, per-user app data (activities, junk-food log, routines, water, weight, goals, settings) and the leaderboard.
- **Responsive layout**: the UI now scales cleanly from small phones up through tablets and desktop instead of staying pinned to a 460px mobile column.

---

## 1. Get a Gmail App Password (for sending verification emails)

1. On the Gmail account you want to send *from*, turn on **2-Step Verification**: https://myaccount.google.com/security
2. Go to https://myaccount.google.com/apppasswords
3. Create an app password (name it "FitForge"). Google gives you a 16-character password — copy it.
4. You'll use this as `GMAIL_APP_PASSWORD` below (not your normal Gmail password).

---

## 2. Deploy the backend to Railway

1. Push the `server/` folder to a GitHub repo (or use Railway's CLI to deploy a local folder directly — `railway up` from inside `server/`).
2. In Railway: **New Project → Deploy from GitHub repo**, pick the repo/folder containing `server/`.
3. **Add a MySQL database**: New → Database → MySQL (in the same Railway project). Railway will generate connection variables.
4. Open your backend service → **Variables** tab and set:
   - `DATABASE_URL` — Railway's MySQL plugin exposes a connection URL (something like `MYSQL_URL` or `MYSQL_PUBLIC_URL`); copy its value into `DATABASE_URL`. (Alternatively set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` individually from the MySQL plugin's variables.)
   - `JWT_SECRET` — generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `JWT_EXPIRES_IN` — e.g. `7d`
   - `GMAIL_USER` — the Gmail address from step 1
   - `GMAIL_APP_PASSWORD` — the 16-character app password from step 1
   - `VERIFICATION_CODE_TTL_MIN` — e.g. `15`
   - `CORS_ORIGIN` — the URL(s) your frontend will be served from, comma-separated (e.g. `https://your-app.vercel.app`). You can update this after step 3 once you know the frontend URL.
   - `PORT` — Railway sets this automatically; you don't need to set it.
5. Deploy. Railway will build from `server/Dockerfile`. The start command in `railway.json` runs `node src/migrate.js` first (creates the tables from `schema.sql`) and then starts the API — so the database schema is applied automatically on first deploy.
6. Once deployed, note your public URL, e.g. `https://fitforge-server-production.up.railway.app`. Test it: `curl https://<your-url>/health` should return `{"ok":true,...}`.

If you'd rather run the schema manually instead of relying on the auto-migrate step: connect with any MySQL client using Railway's credentials and run `server/src/schema.sql` yourself.

---

## 3. Deploy the frontend

The frontend is fully static, so it can be hosted anywhere (Railway static site, Netlify, Vercel, GitHub Pages, or even the same Railway backend service if you prefer one deployment).

1. Edit `frontend/config.js` and set:
   ```js
   window.FITFORGE_API_BASE = 'https://fitforge-server-production.up.railway.app';
   ```
   (use your actual backend URL from step 2.6, no trailing slash)
2. Deploy the `frontend/` folder to your static host of choice.
3. Go back to the backend's `CORS_ORIGIN` variable in Railway and set it to your frontend's live URL, then redeploy the backend so the browser is allowed to call it.

---

## 4. Run it locally first (recommended before deploying)

**Backend:**
```bash
cd server
cp .env.example .env      # fill in DB + Gmail values
npm install
npm run migrate           # creates tables
npm run dev                # starts on http://localhost:4000
```
For local MySQL, either install MySQL directly or run `docker run -e MYSQL_ROOT_PASSWORD=changeme -e MYSQL_DATABASE=fitforge -p 3306:3306 mysql:8`, matching the values in `.env`.

**Frontend:**
```bash
cd frontend
# set window.FITFORGE_API_BASE = 'http://localhost:4000' in config.js
python3 -m http.server 5173   # or any static file server
```
Open http://localhost:5173. In `server/.env`, set `CORS_ORIGIN=http://localhost:5173`.

---

## API summary

| Method | Path                          | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup`            | — | username, fullName, email, password → creates unverified account, emails a code |
| POST | `/api/auth/verify-email`      | — | email, code → verifies account, returns JWT |
| POST | `/api/auth/resend-code`       | — | email → sends a fresh code |
| POST | `/api/auth/login`             | — | username, password → JWT (fails with `needsVerification` if unverified) |
| GET  | `/api/auth/me`                | JWT | current user profile |
| GET  | `/api/data`                   | JWT | all of the user's app data |
| PUT  | `/api/data/:key`               | JWT | upsert one data key (activities, junk, routine, routineLog, water, weight, goals, settings) |
| GET  | `/api/data/leaderboard/all`    | JWT | top 100 users by points |
| POST | `/api/data/leaderboard/points`| JWT | add points to the current user |

## Security notes
- Passwords: bcrypt, 12 rounds.
- Verification codes: 6-digit, bcrypt-hashed at rest, expire (default 15 min), max 5 guess attempts, single active code per user.
- JWT secret and Gmail app password must never be committed — they live only in `.env` / your host's environment variables. `.env` is not included in this package; only `.env.example`.
- Auth endpoints are rate-limited (20 requests / 15 min / IP) to slow down brute-forcing.
