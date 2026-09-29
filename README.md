# OgaAI — Your Hustle Assistant

An AI assistant for Nigerian small traders, students and everyday hustlers.
Replies in **English & Pidgin**. Theme: green / white / red.

## What changed in this version

1. **User login** — email + password sign-up / log-in. Passwords are hashed
   (scrypt) and never stored in plain text. Sessions use signed tokens. The app
   is gated: you must log in before using any tool.
2. **Automatic payment verification** — subscriptions now go through **Monnify
   (Moniepoint's merchant API)**. When money lands, Monnify's webhook + a verify
   call flip the user to Premium automatically — no manual approval.
3. **Real AI model** — the app calls a backend (`server.js`) that talks to a real
   language model, with the key kept only on the server. If the backend is
   unreachable it falls back to built-in offline templates.
4. **Free trial enforced server-side** — 3 tasks/day per account, reset daily.

## Payment modes

- **Live (recommended):** set the `MONNIFY_*` env vars. Subscribers get a secure
  Monnify checkout; payment is verified automatically (webhook + verify endpoint)
  before Premium unlocks. Money settles to your Moniepoint account.
- **Demo (no config):** if `MONNIFY_*` is blank, the app shows your Moniepoint
  account for manual transfer:
  - Bank: **Moniepoint MFB** · Account: **5222649250** · Amount: **₦1,000/month**
  Tapping “I have sent ₦1,000” unlocks Premium (trust-based — for testing only).

## Run locally

```bash
npm install
cp .env.example .env      # then edit .env and add your OPENAI_API_KEY
npm start
```

Open http://localhost:3000

## Deploy (Render / Railway / any Node host)

1. Push this folder to a Git repo.
2. Create a new **Web Service**, build command `npm install`, start command `npm start`.
3. Add environment variables from `.env.example` (at minimum `OPENAI_API_KEY`).
4. The same service serves both the website and the `/api/generate` endpoint.

Works with any OpenAI-compatible provider (OpenAI, Groq, Together, OpenRouter) —
just set `OPENAI_BASE_URL` and `OPENAI_MODEL`.

## Security notes (please read)

- The AI key and payment secrets live **only on the server** (env vars). Never
  put them in `app.js`.
- `/api/generate` now **requires login** and enforces the daily free-trial limit
  server-side, so people can't burn your AI credits anonymously.
- Set a strong `SESSION_SECRET` in production.
- **Webhook:** point your Monnify dashboard webhook to
  `https://YOUR-DOMAIN/api/pay/webhook`. The server verifies Monnify's
  `monnify-signature` (HMAC-SHA512) before unlocking Premium.
- The user store is a simple `data/users.json` file — fine for a prototype.
  For real scale, move it to a database (Postgres, etc.).
- Confirm the exact **account name** on Moniepoint 5222649250 and set it in the
  `BANK` object at the top of `app.js` (used only for the demo transfer screen).
- Always test against Monnify **sandbox** first, then switch `MONNIFY_BASE_URL`
  to the live URL.

## API endpoints

- `POST /api/auth/signup` · `POST /api/auth/login` · `GET /api/auth/me`
- `POST /api/generate` (auth) — AI generation
- `POST /api/pay/init` (auth) — start subscription payment
- `GET  /api/pay/verify` (auth) — check & unlock Premium
- `POST /api/pay/webhook` — Monnify calls this automatically
- `GET  /api/config`, `GET /api/health`

## Files

- `index.html`, `styles.css`, `app.js` — the mobile-feel web app (front-end)
- `server.js` — backend: auth + AI proxy + Monnify payments + static server
- `package.json`, `.env.example` — config
- `data/users.json` — created automatically at runtime (user accounts)
