# Faven — Hardening Backlog

> Issues deferred from demo hardening pass (25 August 2026), grouped by category.
> Each item: **Risk** → **Fix**.

---

## Verification Integrity

### EXIF spoofing via photo editors
**Risk:** GPS metadata can be trivially spoofed with desktop tools or purpose-built apps. The current system accepts any valid EXIF as genuine.
**Fix:** Require in-app camera capture via Play Integrity / DeviceCheck attestation to prove the photo was taken on an unmodified device at claim time.

### Per-venue distance thresholds
**Risk:** Global 200 m radius doesn't account for venue size (stadium vs café) or GPS accuracy indoors.
**Fix:** Add per-restaurant `verification_radius_m` column; allow manual or crowd-sourced calibration per venue.

### Weighted confidence scoring
**Risk:** Current tier logic counts signals (4-5 = full). UPI proof arguably stronger than AI pass; photo EXIF strongest. Equal weighting under-values high-trust signals.
**Fix:** Replace signal counting with weighted confidence score (e.g., EXIF 40%, UPI 30%, AI 15%, receipt 10%, community 5%) and a threshold cutoff for tier classification.

### UTR verification via RBI Account Aggregator
**Risk:** Current 12-digit format check is not a verification — attacker can invent UTRs. Once SMS pumping is live, fake UTRs paired with real EXIF bypasses credibility.
**Fix:** Integrate RBI Account Aggregator or bank statement OCR to confirm UTR belongs to the claiming user and matches the restaurant VPA.

---

## Security

### JWT rotation / revocation
**Risk:** 30-day JWTs with no rotation or revocation. A stolen token is valid for the full window; logout is client-side only.
**Fix:** Add refresh-token flow with short-lived access tokens (15 min) + server-side revocation list (or switch to session IDs).

### Upload validation
**Risk:** `multer` accepts any file up to 10 MB. Large non-image payloads waste disk; malicious files could exploit downstream processors.
**Fix:** Validate magic bytes, enforce JPEG/PNG, reject oversized or zero-byte files, run antivirus scan in CI.

### Admin audit log
**Risk:** Moderation actions (flag/remove/restore) are not logged. If an admin account is compromised or acts maliciously, there's no forensic trail.
**Fix:** Write an immutable audit log row (`admin_id`, `action`, `target`, `timestamp`, `ip`) for every admin mutation.

### Admin 2FA
**Risk:** Admin JWT is identical to user JWT with an `is_admin` flag. No additional factor for privileged actions.
**Fix:** Require TOTP or WebAuthn for admin login and/or for destructive moderation actions.

---

## Payments / Rewards

### Integer paise instead of float INR
**Risk:** `amount_inr DECIMAL(8,2)` and JS `Number` float introduce rounding errors at scale.
**Fix:** Store all currency values in paise as `BIGINT`; convert only at display.

### Double-entry ledger
**Risk:** Single `reward_ledger` table with no contra entries. Impossible to reconcile without audit.
**Fix:** Implement proper double-entry bookkeeping (credit/debit pairs) per standard accounting.

### Idempotency keys
**Risk:** If a payout request is retried (network flap, server restart), user may be credited twice.
**Fix:** Require client-generated idempotency key on all reward-triggering operations; dedupe on key.

### Payout caps and fraud rules
**Risk:** No per-user or per-day payout cap. A compromised or colluding account could drain the rewards pool.
**Fix:** Env-configurable daily cashback cap per user; velocity checks; device + VPA fingerprinting to detect multi-accounting.

---

## Data & Scale

### Redis leaderboard / caching
**Risk:** Leaderboard is computed O(n) on every request. Scales poorly beyond a few thousand users.
**Fix:** Pre-compute leaderboard into Redis sorted set on post; refresh async or via cron; serve from cache.

### Versioned migrations (Knex / Prisma)
**Risk:** Schema changes via ad-hoc SQL scripts (`schema.sql`, `migrate-*.js`). No rollback, no version tracking, drift between envs.
**Fix:** Adopt Knex or Prisma with numbered migration files, automatic tracking table, CI enforcement.

### S3 / CDN for uploads
**Risk:** Photos served from local filesystem. Single-server, no CDN, no redundancy, no cache headers.
**Fix:** Move uploads to S3 (or R2/GCS); serve via CloudFront or equivalent; set long-lived cache headers for immutable assets.

### Google Places ToS on caching
**Risk:** Caching place data in `restaurants` may violate Google ToS (attribution, refresh intervals, storage duration).
**Fix:** Review ToS; add attribution; implement refresh policy or switch to OpenStreetMap / proprietary data.

### Search transliteration
**Risk:** Users searching in Kannada/Hindi won't match English restaurant names.
**Fix:** Add transliteration layer (Google Translate API or local library) or index both scripts.

### Credibility decay
**Risk:** Credibility score never decreases. A creator who verified 50 posts two years ago but now posts AI-generated spam retains high score.
**Fix:** Implement time-decay factor; recent activity counts more than historical.

---

## Compliance

### DPDP consent / erasure / retention
**Risk:** No explicit consent capture, no data-erasure flow, no defined retention policy. Non-compliant with India's Digital Personal Data Protection Act 2023.
**Fix:** Add consent modal on first login; implement `DELETE /me` with cascading erasure; define and enforce retention periods.

### CCPA endorsement disclosure
**Risk:** Paid-to-post reviews may trigger FTC endorsement rules if US users participate. Currently no explicit disclosure beyond "Sponsored" toggle.
**Fix:** Surface clear "This creator earned a reward for this review" disclosure; consult legal on geography gating.

### IT Act §79 intermediary status
**Risk:** Hosting user-generated reviews without proper takedown process may forfeit safe-harbor.
**Fix:** Publish grievance officer contact; implement 72 h content-review SLA on flagged posts; maintain records per CERT-In guidelines.

---

## Process / DevOps

### CI on push
**Risk:** Tests run locally but not enforced. Broken code can reach `main`.
**Fix:** GitHub Actions workflow: `npm test` + lint + type-check on every PR and push to `main`.

### Branch protection on `main`
**Risk:** Anyone with push access can force-push or merge without review.
**Fix:** Require PR with at least one approval; require CI pass; disallow force-push.

### Adversarial test suite
**Risk:** Current tests cover happy paths. No fuzz testing, no negative verification cases (spoofed EXIF, malformed uploads).
**Fix:** Add property-based tests (fast-check), upload malformed JPEGs, inject invalid lat/lng, test rate-limiter edge cases.

### Analytics instrumentation
**Risk:** No visibility into user behavior, funnel drop-off, or error rates in production.
**Fix:** Add lightweight event logging (Mixpanel, PostHog, or self-hosted Plausible); instrument key flows (login, post, verify).

---

*This list is deliberate — these are known gaps, not unknown unknowns.*
