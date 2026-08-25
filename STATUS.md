# Faven — Project Status

> One-page **Built / Stubbed / Not started** overview for technical diligence.
> **Last updated:** 25 August 2026 (Session 2)

| Component | Status | Notes |
|---|---|---|
| **Phone OTP auth** | Built | JWT 30-day sessions; dev OTP bypass (`DEV_OTP_CODE`) env-gated; boot guard refuses production start with bypass enabled |
| **OTP rate limiting** | Built | Per-phone (3/min) + per-IP (10/min) + verify attempt counters; in-memory (Redis not implemented) |
| **Search** | Built | Name/cuisine/address restaurant search + full-text review body search via `/search` |
| **Review submission** | Built | Star rating, photo (multipart), UTR, sponsored toggle; returns verification tier + rewards |
| **EXIF verification** | Built | GPS haversine (200m threshold), timestamp recency (72h); `exifr` extraction server-side |
| **UTR verification** | Stubbed | Format validation only (12-digit); real RBI Account Aggregator / provider integration pending |
| **Receipt OCR** | Stubbed | File accepted but no OCR; placeholder returns `ocr_not_implemented` |
| **Hive AI detection** | Stubbed | Env-gated on `HIVE_API_KEY`; dev stub passes photos; production API call implemented but untested in prod |
| **Community corroboration** | Built | ≥1 other user's location-verified review at same restaurant within 7-day window (env-configurable) |
| **Tier computation** | Built | Unweighted signal count: 4-5 signals → full, 2-3 → partial, else reviewed |
| **First-post cashback (₹25)** | Built (mock) | Presence proof gate (EXIF + 1 other); once per user, idempotent; writes to `reward_ledger` but no real payout |
| **FAV Coins** | Built (mock) | Balance in `users.coins`; ledger entries; no real token/currency |
| **Streaks** | Built | Daily increment; weekly bonus (50 coins every 7 days); resets on gap |
| **Voucher milestones** | Built (data model) | 5/10/20-post thresholds recorded; redemption not implemented |
| **Leaderboard** | Built | Monthly; rank movement (prev_rank vs current); O(n) recompute |
| **Credibility score** | Built | Tier-weighted formula; sponsored half-weight; streak bonus; capped at 100 |
| **Moderation dashboard** | Built | Web admin UI; flag/remove/restore with notes; requires admin JWT |
| **Dataset stats (investor view)** | Built | `GET /stats` returns aggregates + verification rates + location scatter |
| **Demo venue seed** | Built | CLI script seeds restaurants at venue coords + corroborating reviews; enables on-device demo |
| **Error/timeout hardening** | Built | Themed error states with retry on all screens; outbound verification timeouts env-configurable |
| **Push notifications** | Not started | Expo-notifications + FCM deferred (needs EAS build + device) |
| **Payouts (Razorpay)** | Not started | `reward_ledger` is mock; no real disbursement |
| **SMS provider** | Not started | OTP is hardcoded dev value; real Twilio/MSG91 integration pending |
| **EAS Build** | Config only | `eas.json` with internal APK profile; cloud build requires Expo account login |
| **Deployment** | Not started | API runs locally; Railway/AWS deployment deferred to Sprint 5+ |
| **EXIF privacy** | Built | Originals stored in `uploads/originals/` (not statically served); served images EXIF-stripped via piexifjs. **Caveats:** piexifjs handles JPEG only — PNG/HEIC uploads are copied as-is; XMP/IPTC metadata blocks (which can also carry GPS) are not stripped. |
| **Waitlist** | Built | `POST /waitlist` wired to landing page with graceful fallback |
