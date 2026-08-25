# Faven — Project Status

> One-page **Built / Stubbed / Not started** overview for technical diligence.
> **Last updated:** 25 August 2026

| Component | Status | Notes |
|---|---|---|
| **Phone OTP auth** | Built | JWT 30-day sessions; dev OTP bypass (`DEV_OTP_CODE`) env-gated; boot guard refuses production start with bypass enabled |
| **OTP rate limiting** | Built | Per-phone (3/min) + per-IP (10/min) + verify attempt counters; in-memory (Redis not implemented) |
| **Restaurant search** | Built | Name/cuisine/address search; full-text review body search via `/search` |
| **Review submission** | Built | Star rating, photo (multipart), UTR, sponsored toggle; returns verification tier + rewards |
| **EXIF verification** | Built | GPS haversine (200m threshold), timestamp recency (72h); `exifr` extraction server-side |
| **UTR verification** | Stubbed | Format validation only (12-digit); real RBI Account Aggregator / provider integration pending |
| **Receipt OCR** | Stubbed | File accepted but no OCR; placeholder returns `ocr_not_implemented` |
| **Hive AI detection** | Stubbed | Env-gated on `HIVE_API_KEY`; dev stub passes photos; production API call implemented but untested in prod |
| **Community corroboration** | Not started | Signal count always 0; post-MVP per product doc |
| **Tier computation** | Built | 4-5 signals → full, 2-3 → partial, else reviewed; weighted by signal presence |
| **First-post cashback (₹25)** | Built (mock) | Presence proof gate (EXIF + 1 other); writes to `reward_ledger` but no real payout |
| **FAV Coins** | Built (mock) | Balance in `users.coins`; ledger entries; no real token/currency |
| **Streaks** | Built | Daily increment; weekly bonus (50 coins every 7 days); resets on gap |
| **Voucher milestones** | Built (data model) | 5/10/20-post thresholds recorded; redemption not implemented |
| **Leaderboard** | Built | Monthly; rank movement (prev_rank vs current); O(n) recompute |
| **Credibility score** | Built | Tier-weighted formula; sponsored half-weight; streak bonus; capped at 100 |
| **Moderation dashboard** | Built | Web admin UI; flag/remove/restore with notes; requires admin JWT |
| **Search** | Built | Full-text keyword search across restaurants + review bodies |
| **Dataset stats (investor view)** | Built | `GET /stats` returns aggregates + verification rates + location scatter |
| **Push notifications** | Not started | Expo-notifications + FCM deferred (needs EAS build + device) |
| **Payouts (Razorpay)** | Not started | `reward_ledger` is mock; no real disbursement |
| **SMS provider** | Not started | OTP is hardcoded dev value; real Twilio/MSG91 integration pending |
| **EAS Build** | Config only | `eas.json` with internal APK profile; cloud build requires Expo account login |
| **Deployment** | Not started | API runs locally; Railway/AWS deployment deferred to Sprint 5+ |
| **EXIF privacy** | Built | Originals stored privately; served images EXIF-stripped via piexifjs |
| **Waitlist** | Built | `POST /waitlist` wired to landing page with graceful fallback |
