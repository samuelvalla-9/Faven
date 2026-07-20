# Faven — Implementation Plan (Solo Agile Build)

> **Product:** Faven ("Food Haven") — India's first verified food experience platform.
> "Instagram for food, but every post is tied to proof the creator was actually there."
> **Source docs:** `Faven_Document.html` (product & strategy), `faven-landing_4.html` (marketing page).
> **Mode:** Individual project, agile — thin vertical slices, every sprint ends in a demoable increment.
> **Last updated:** 20 July 2026 (Sprint 4 ✓ complete: search, AI authenticity, moderation dashboard, UX/a11y/UI polish)

---

## Tech Stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| Mobile app | **Expo (SDK 57) + TypeScript** | Overrides doc's "no Expo" — EAS dev builds + config plugins remove old limitations. OTA updates via EAS Update. |
| Backend | **Node.js + Express** | Chosen over Spring Boot for solo speed. |
| Database | **MySQL** | Local for dev; Railway/AWS later. |
| Auth | Phone OTP → JWT (30-day) | Dev OTP: `123456` (`DEV_OTP_CODE` in `api/.env`). SMS provider later. |
| Storage | Local `api/uploads/` for dev | S3 in production. |
| Payments/rewards | Mock ledger (`reward_ledger` table) | Real Razorpay/Cashfree deferred to Phase 2. In-app currency is branded **FAV Coins** everywhere in UI/copy (DB column stays `coins`). |
| Design system | **Ember & Parchment palette** | Tokens in `app/src/theme.ts`, mirrors landing page `[data-theme="ember"]`. |

### Ember palette reference

| Token | Hex |
|---|---|
| espresso / espresso-2 | `#1B151C` / `#241C26` |
| accent | `#E15544` |
| accent-ink / accent-hover / accent-tint | `#B33726` / `#C23F30` / `#FBE1DC` |
| accent-2 | `#C98A4B` |
| green / green-deep | `#3E7D5A` / `#2B5940` |
| paper / paper-2 | `#F5F1E8` / `#FAF8F2` |
| ink / ink-soft | `#1F1A1C` / `#6B6165` |

### Verification tiers (product rule)

5 signals: UPI (UTR), photo EXIF GPS/timestamp, receipt OCR, AI photo authenticity, community corroboration.
- **4–5 signals → `full`** (Fully Verified, max reach)
- **2–3 signals → `partial`** (Partially Verified)
- **0–1 signals → `reviewed`** (AI scan only)
- Sponsored visits: transparent toggle, never hidden.

Logic lives in `api/src/services/verification.js` (`computeTier`).

---

## Sprint 0 — Foundation ✅ COMPLETE (verified 19 Jul 2026)

- [x] Landing page defaults to ember theme (`faven-landing_4.html`)
- [x] Backend scaffold `api/`: Express server, routes (`auth`, `restaurants`, `reviews`, `leaderboard`), verification service stub, JWT middleware
- [x] MySQL schema (`users`, `otp_codes`, `restaurants`, `reviews`, `reward_ledger`) + `db:init` + `db:seed` (Bangalore restaurants, 3 users, 8 reviews)
- [x] Expo app scaffold `app/`: ember theme tokens, API client (auto-detects LAN IP from Expo hostUri; `EXPO_PUBLIC_API_URL` override), Auth → Feed → Leaderboard screens
- [x] End-to-end verified in **web mode** (`npx expo start --web`, http://localhost:8081)

**Environment notes / gotchas learned:**
- dotenv must load `api/.env` by absolute path (fixed in server.js, pool.js, init.js).
- Corporate machine: no admin → inbound firewall rules can't be added; ngrok/localtunnel blocked. **Web mode is the primary dev loop.** Expo Go on phone may work over LAN (Metro on `192.168.0.185`) if firewall allows; USB + `adb reverse` is the fallback for Android.
- Start scripts: `app/start-web.ps1`, `app/start-tunnel.ps1` (tunnel blocked on corp network).
- Run API detached: `Start-Process -WindowStyle Hidden node -ArgumentList '<abs path>\api\src\server.js'`

---

## Sprint 1 — Core Loop (1–2 weeks) ✅ COMPLETE

**Goal:** A signed-in user can find a restaurant, post a review with a photo, and see it in the feed. Demo: full post loop on web.

- [x] **Restaurant search screen** — search bar querying `GET /restaurants?q=`, result list, tap → detail screen with reviews (`GET /restaurants/:id`)
- [x] **Review submission screen** — star rating, text body, photo via `expo-image-picker` (EXIF enabled), sponsored toggle → `POST /reviews` (multipart)
- [x] **Rewards feedback** — show ₹25 first-post cashback + coins toast/modal from the submit response
- [x] **Profile screen** — view/edit name, username, city (`PATCH /auth/me`); show coins, credibility, streak
- [x] **Token persistence** — `@react-native-async-storage/async-storage`; auto-login on relaunch (`GET /auth/me`)
- [x] **Feed photos** — render `photo_url` images in feed cards
- [ ] (Stretch) Google Places integration behind the search endpoint, cached into `restaurants` table with session tokens

**Known caveat:** browsers strip EXIF GPS — real EXIF testing needs a device (Sprint 2).

---

## Sprint 2 — Verification Slice (1–2 weeks) ✅ COMPLETE (EAS dev build deferred — needs device/EAS account)

**Goal:** Posts earn real verification tiers. Demo: a photo with GPS metadata gets `exif_verified=1` and a Partially Verified badge.

- [x] **EXIF extraction server-side** (`exifr`): parse GPS + timestamp from uploaded photo (`extractExif`)
- [x] **Location cross-check** — haversine distance photo GPS ↔ restaurant lat/lng (200m threshold, env `EXIF_MAX_DISTANCE_M`); timestamp recency window (72h, env `EXIF_MAX_AGE_HOURS`)
- [x] **Tier computation live** — `POST /reviews` runs verifyExif/verifyUpi/verifyReceipt/verifyAiAuthenticity; response includes `verification` (tier, signals, per-signal reasons); post-submit modal shows tier badge + signal count
- [x] **First-post ₹25 cashback goes live** — gated on `tier === 'full'`; reachable now that signals are real
- [x] **UPI/UTR + receipt OCR interfaces** — `utr` form field (12-digit, dev format-check mock; real provider env-gated), `receipt` file field (OCR stub); UTR input added to Post screen
- [x] **Sponsored disclosure UI** — visible "Sponsored" label on review cards (shipped in Sprint 1's `TierBadge`)
- [ ] **Switch to EAS development build** for device testing (Expo Go insufficient once native modules grow) — requires device/EAS account session
- [x] **API integration tests** for verification logic — Jest, 31 tests across 2 suites: `api/tests/verification.test.js` (unit: tiers, haversine, EXIF evaluation, UPI/receipt/AI stubs) + `api/tests/exif.integration.test.js` (real geotagged JPEGs through exifr); `npm test`
- [x] **Code coverage reporting** — `npm run test:coverage` → `api/coverage/` (lcov.info, cobertura-coverage.xml, HTML report); `verification.js` at ~94% stmts / 93% branches; `coverage/` gitignored

**Notes:** browsers strip EXIF GPS, so `exif_verified` needs a real-device photo upload to trigger — logic is unit-tested against synthetic EXIF data. Community corroboration stays 0 (post-MVP).

**Demo goal achieved (20 Jul 2026):** generated a geotagged JPEG (`api/scripts/make-test-photo.js`, piexifjs) at CTR's coords, posted via API → `exif_verified=1`, tier `partial`. EXIF pipeline also covered by integration tests (`api/tests/exif.integration.test.js`, real files through exifr).

---

## Sprint 3 — Rewards & Retention (1 week) ⬅ IN PROGRESS

**Goal:** Gamification loop feels real. Demo: streaks tick daily, leaderboard reflects verified posts, push notification on reward.

- [x] **Streak logic** — server-side daily streak update on post (`streak_days`, `last_post_date`); streak coins (weekly bonus) — `api/src/services/rewards.js` (`computeStreak`: consecutive-day increment, same-day no-op, gap reset; +50 coins every 7-day multiple, env `STREAK_WEEKLY_BONUS_COINS`); wired into `POST /reviews` (ledger `coins_streak` entries; response includes `streak`); 12 unit tests in `api/tests/rewards.test.js`
- [x] **Rewards ledger screen** — cashback + coins history from `reward_ledger`: `GET /rewards` (auth; last 100 entries + ₹/coins totals, `api/src/routes/rewards.js`) · app: "Rewards history" toggle on Profile screen (`RewardsHistory` in `app/App.tsx`, totals StatBoxes + entry cards)
- [x] **Leaderboard polish** — monthly reset framing, rank movement, current-user highlight — API: `GET /leaderboard` now returns `month`, `resets_in_days`, and per-row `rank`/`prev_rank`/`movement` (vs last month's standings, same ordering); app: season banner with reset countdown, ▲/▼/NEW movement indicators (`RankMovement`), "(you)" row with accent-tint highlight, verified-post count per row
- [x] **Voucher milestones (data model only)** — 5/10/20 lifetime-post thresholds (₹100/₹250/₹600) — new `voucher_milestones` table (unique per user+threshold, status `earned/redeemed/expired`; redemption deferred); `milestoneForPostCount` in `api/src/services/rewards.js`; `POST /reviews` records milestone + `voucher` ledger entry on the exact crossing post; 5 new unit tests (48 total)
- [ ] **Push notifications** — `expo-notifications` + FCM: reward earned, streak reminder — **deferred**: needs FCM setup + physical device/EAS build (blocked on corp setup, same as Sprint 2 EAS item)
- [x] **Credibility score v1** — tier-weighted formula in `api/src/services/credibility.js`: full=10 / partial=5 / reviewed=1 pts, sponsored posts at half weight, +1 pt per streak day (cap 10), score cap 100 (all env-overridable `CRED_*`); idempotent full recompute persisted on every `POST /reviews` (response includes `credibility`); 8 unit tests in `api/tests/credibility.test.js`

---

## Sprint 4 — Trust & Polish (1 week) ✅ COMPLETE

**Goal:** MVP feature-complete per product doc. Demo: moderation dashboard + AI check + polished ember UI.

- [x] **AI photo authenticity** — Hive AI-generated media detection in `api/src/services/verification.js`: env-gated on `HIVE_API_KEY` (URL/threshold via `HIVE_API_URL`, `HIVE_AI_GEN_THRESHOLD`, default 0.7); pure `evaluateHiveResponse` parser (testable); provider errors **fail open** so posting never breaks; dev stub without key; 8 new tests (62 total)
- [x] **Moderation dashboard (web)** — Express-served ember-styled page at `GET /admin` (`api/src/admin/dashboard.html`: paste admin JWT, tabs for flagged/visible/removed/all/users, flag·remove·restore with notes); API: `GET /admin/reviews?status=`, `POST /admin/reviews/:id/status`, `GET /admin/users` behind `auth` + new `admin` middleware (`users.is_admin`); reviews get `status`/`moderation_note` columns; removed reviews hidden from feed/detail/search; migration `api/scripts/migrate-sprint4-moderation.js`
- [x] **Keyword search across reviews** — `GET /search?q=&limit=` (`api/src/routes/search.js`): matches restaurants (name/cuisine/address) + review bodies in one response; 400 on missing `q`, limit clamped 1–50; mounted in `server.js`
- [x] **UX pass** — in `app/App.tsx`: card loading skeletons (`SkeletonCards`, static — reduced-motion friendly), themed `ErrorState` with retry on Feed/Search/detail/Leaderboard/Rewards (errors no longer swallowed), "Searching…" feedback, pull-to-refresh added to Leaderboard (Feed already had it)
- [x] **Accessibility** — WCAG AA contrast audit + fixes: buttons use `accentInk` bg (white 6.0:1 vs accent's 3.76:1), new `accent2Ink` token (#8A5A24, 5.5:1 on paper) for amber text, tier badges get per-tier text colors (`tierTextColors`: ink-on-amber 5.9:1, white-on-greenDeep 8.1:1); tab bar `accessibilityRole/state`; skeletons static (reduced-motion safe)
- [x] **Ember UI polish** — `typeScale` typography tokens in `app/src/theme.ts` (display/h1/h2/body/meta/badge) applied across headings, cards, badges, buttons; consistent badge styling via `tierColors` + `tierTextColors`

---

## Sprint 5 — Release & Feedback (1 week) ⬅ NEXT

**Goal:** Real users on the app; feedback loop running.

- [ ] **Deploy API** to Railway (MySQL + uploads → S3-compatible storage); env-based config
- [ ] **EAS Build** — Android internal distribution (APK/AAB); iOS TestFlight if Apple account available
- [ ] **EAS Update** configured for OTA hotfixes
- [ ] **Onboard ~10 testers**; capture feedback (simple form or GitHub issues)
- [ ] **1-week feedback cycle** → groom backlog, fix top issues
- [ ] **Landing page waitlist** — wire the demo form to a real endpoint (`POST /waitlist`)

---

## Explicitly OUT of MVP scope (per product doc)

Subscriptions (Pro ₹499 / Elite ₹1,499), brand campaign marketplace, semantic search, aesthetic visual AI, restaurant confirmation flows, community corroboration signal, B2B data licensing, voucher redemption.

## Post-MVP roadmap (from product doc, for reference)

| Phase | Timeline | Focus | Target |
|---|---|---|---|
| 1 | M0–3 | Open platform, seed 50 Elite creators (Bangalore) | 2K creators, 500 verified reviews |
| 2 | M3–6 | Voluntary verification, Pro launch, vouchers | 10K creators, 500 Pro, ₹2.5L MRR |
| 3 | M6–12 | Verified-first algorithm, brand marketplace, Mumbai/Delhi | 25K creators, ₹12L MRR |
| 4 | M12–18 | Full enforcement, data licensing, SEA planning | 50K creators, ₹35L+ MRR |

---

## Dev quick reference

```powershell
# API (from anywhere — .env loads by absolute path)
node api/src/server.js               # or: cd api; npm run dev
cd api; npm run db:init; npm run db:seed

# App (web mode — primary dev loop)
powershell -ExecutionPolicy Bypass -File app/start-web.ps1   # → http://localhost:8081

# Health check
curl http://localhost:4000/health

# Moderation dashboard (paste an admin JWT — user must have users.is_admin=1)
# http://localhost:4000/admin · one-off migration: node api/scripts/migrate-sprint4-moderation.js

# Tests & coverage
cd api; npm test                     # 62 tests (verification + Hive parsing + EXIF integration + streak/rewards/milestones + credibility)
cd api; npm run test:coverage        # lcov + cobertura + HTML → api/coverage/
node api/scripts/make-test-photo.js 13.0027 77.5701 test.jpg   # geotagged JPEG for manual EXIF e2e

# Login flow (dev): any 10-digit phone → OTP 123456
```

**Key files:**
- API entry: `api/src/server.js` · routes: `api/src/routes/` (incl. `search.js`) · verification: `api/src/services/verification.js` · rewards/streaks: `api/src/services/rewards.js` · credibility: `api/src/services/credibility.js`
- Tests: `api/tests/` (Jest; helper `tests/helpers/geotaggedJpeg.js` generates EXIF fixtures) · coverage config in `api/package.json`
- Schema/seed: `api/src/db/schema.sql`, `seed.js` · env: `api/.env` (never commit)
- App entry: `app/App.tsx` · theme: `app/src/theme.ts` · API client: `app/src/api.ts`
