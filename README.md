# Faven 🍜

> **India's first verified food experience platform** — "Instagram for food, but every post is tied to proof the creator was actually there."

Faven fights fake reviews with a multi-signal verification engine: UPI payment proof, photo EXIF GPS/timestamp, receipt OCR, AI photo-authenticity checks, and community corroboration. Verified creators earn **FAV Coins**, cashback, streaks, and leaderboard rank.

## ✨ Features (MVP)

- 📱 **Phone OTP auth** → JWT sessions (30-day)
- 🔍 **Restaurant & review search** — restaurants by name/cuisine/address, plus full-text review search
- 📝 **Verified reviews** — star rating, photo (EXIF preserved), UPI UTR, sponsored disclosure
- ✅ **Verification tiers** — 4–5 signals → **Fully Verified**, 2–3 → **Partially Verified**, 0–1 → **Reviewed**
  - EXIF GPS cross-checked against the restaurant location (haversine, 200 m) + 72 h recency window
  - AI-generated photo detection via Hive *(stub — provider integration pending; env-gated on `HIVE_API_KEY`, dev passes photos as authentic)*
  - UPI UTR verification *(format validation only — 12-digit check; real provider integration via RBI Account Aggregator pending)*
  - Receipt OCR *(stub — OCR not implemented)*
  - Community corroboration *(not implemented — post-MVP)*
- 🎁 **Rewards** — ₹25 first-post cashback *(mock ledger — real Razorpay Payouts pending)*, FAV Coins *(mock balance)*, daily streaks with weekly bonuses, voucher milestones at 5/10/20 posts *(data model only — redemption pending)*
- 🏆 **Monthly leaderboard** — rank movement (▲/▼/NEW), season reset countdown, credibility score v1
- 🛡️ **Moderation dashboard** — admin web UI to flag/remove/restore reviews (`GET /admin`)
- 🎨 **Ember & Parchment design system** — WCAG AA audited, reduced-motion friendly

## 🧱 Tech Stack

| Layer | Choice |
|---|---|
| Mobile app | Expo (SDK 57) + TypeScript + React Native (web/iOS/Android) |
| Backend | Node.js + Express |
| Database | MySQL |
| Auth | Phone OTP → JWT |
| Photo verification | `exifr` (EXIF GPS/timestamp) + Hive AI detection |
| Testing | Jest + Supertest (81 tests, ~94% coverage on verification core) |

## 📁 Repository layout

```
api/                  Express backend
  src/server.js       Entry point (port 4000)
  src/routes/         auth, restaurants, reviews, search, leaderboard, rewards, admin
  src/services/       verification, rewards, credibility
  src/db/             schema.sql, init, seed (Bangalore demo data)
  src/admin/          moderation dashboard (web)
  tests/              Jest suites
app/                  Expo mobile/web app
  App.tsx             Screens: Auth, Feed, Search, Post, Leaderboard, Profile/Rewards
  src/theme.ts        Ember design tokens
  src/api.ts          API client (auto-detects LAN IP from Expo hostUri)
Faven_Document.html   Product & strategy doc
faven-landing_4.html  Marketing landing page
```

## 🚀 Getting started

### Prerequisites

- Node.js 18+
- MySQL 8 running locally
- (Optional) Expo Go on your phone, on the same Wi-Fi

### 1. Backend

```powershell
cd api
npm install
# create api/.env — see below
npm run db:init     # create schema
npm run db:seed     # demo restaurants, users, reviews
npm run dev         # http://localhost:4000
```

`api/.env` (never commit this file):

```dotenv
PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<your password>
DB_NAME=faven
JWT_SECRET=<random string>
DEV_OTP_CODE=123456
# optional: HIVE_API_KEY, EXIF_MAX_DISTANCE_M, EXIF_MAX_AGE_HOURS, ...
```

### 2. App — web (primary dev loop)

```powershell
cd app
npm install
npx expo start --web    # http://localhost:8081
```

Sign in with any phone number and dev OTP `123456`.

### 3. App — Expo Go (physical device)

```powershell
cd app
npx expo start --lan
```

Scan the QR in Expo Go (`exp://<your-LAN-IP>:8081`). The API client auto-detects your machine's LAN IP; override with `EXPO_PUBLIC_API_URL` if needed. Real EXIF GPS verification requires a device photo (browsers strip EXIF).

### 4. Tests

```powershell
cd api
npm test              # 81 tests
npm run test:coverage # HTML report in api/coverage/
```

## 🔌 API overview

| Endpoint | Description |
|---|---|
| `POST /auth/request-otp` · `POST /auth/verify-otp` | Phone OTP login → JWT *(SMS stub — dev OTP hardcoded)* |
| `GET /auth/me` · `PATCH /auth/me` | Profile |
| `GET /restaurants?q=` · `GET /restaurants/:id` | Search / detail with reviews |
| `POST /reviews` (multipart) | Submit review → verification tier + rewards |
| `GET /search?q=` | Keyword search across restaurants + review text |
| `GET /leaderboard` | Monthly standings with rank movement |
| `GET /rewards` | Cashback/coins ledger + totals *(mock ledger)* |
| `GET /stats` | Aggregate dataset stats (total reviews, verification rates, tier breakdown) |
| `GET /admin` + `/admin/reviews`, `/admin/users` | Moderation (admin JWT) |
| `GET /health` | Health check |

## 📋 Roadmap

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Sprints 0–4 complete (foundation, core loop, verification, rewards & retention, trust & polish). Deferred: EAS device builds, push notifications, real payment/SMS providers, voucher redemption.

## 📄 License

See [app/LICENSE](app/LICENSE).
