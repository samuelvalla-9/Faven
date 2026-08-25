# Copilot Agent Task Brief — Faven Investor-Demo Hardening

**Paste this whole file to the coding agent as the session brief.**

---

## 0. Mission

The Faven repo (`C:\Users\2478356\projects\Faven`) is a **prototype whose only near-term job is a live investor demo on a physical Android phone**, plus surviving technical diligence on the repo itself.

Your job in this session is **not** production hardening. It is to make three things true:

1. The full verification → reward loop runs **on a real device**, with real camera EXIF, live on stage.
2. The demo can show a **rejection** as well as a success, and ends with the **₹25 reward moment** firing.
3. Nothing in the repo could be read by a technical advisor as **misrepresenting a stub as a working integration**.

Optimise every decision against those three. If a change does not serve them, it is out of scope — log it instead (see T12).

---

## 1. Hard constraints

**Non-goals — do NOT do these, even if you spot them:**

- No refactor of `app/App.tsx` (no expo-router, no react-query, no file splitting). A working monolith beats a half-migrated tree on demo day.
- No Redis, no S3, no CDN, no Railway deploy, no versioned-migration framework (Knex/Prisma), no JWT refresh/rotation.
- No new test coverage beyond what individual tasks below require. 62 passing tests is already a pitch asset — keep them green, don't grow the suite.
- No changes to search relevance, credibility decay, leaderboard snapshotting, or the O(n) recompute.
- No new npm dependencies unless a task explicitly names one. If you believe one is unavoidable, stop and ask.
- Do not touch `Faven_Document.html` or `faven-landing_4.html` except where T11 says so. Both files exist and are current source-of-truth product docs.

**Process rules:**

- Follow `GIT_PROTOCOL.md` exactly: per-repo identity check before first commit, Conventional Commits, `git add -A`, commit + push per completed task, no force-push, no `git add -f`.
- **One task = one commit.** Do not batch tasks into a single commit. Suggested messages are given per task.
- Verify `git check-ignore api/.env` passes before any staging. Never print, commit, or document secrets, tokens, or the PAT.
- After each task: run `cd api; npm test`. **All 62 tests must stay green.** If a task breaks a test, fix the test only if the test encoded the old (wrong) behaviour — say so in the commit body.
- Update `IMPLEMENTATION_PLAN.md` in the same session per the protocol's "Documentation upkeep" section: tick boxes, annotate what was actually built with file paths, refresh **Last updated**, add new commands to **Dev quick reference**.
- If a task is blocked (needs a device, an account, a credential, a decision), **stop and report the blocker in one line** rather than inventing a workaround or a mock that looks real.

---

## 2. Task order and gating

Tasks are ordered. **T1 gates everything else** — the demo does not exist without it. T2–T5 are the demo mechanics. T6–T8 are the two security/privacy items that stay in scope because they are cheap and a breach during the demo period is unrecoverable. T9–T12 are diligence artifacts.

If time runs short, the minimum shippable set is **T1, T2, T3, T6, T9**.

---

## T1 — Get a real build onto a physical Android device

**Why:** Browsers strip EXIF GPS. In web mode the differentiator is a mock, so the entire demo currently rests on "trust us." Everything below assumes a device.

**Do:**
- Configure `app/eas.json` with an `internal` / `preview` profile producing an **APK** for Android internal distribution. EAS builds run in Expo's cloud — the corporate-machine admin/firewall blocker documented in Sprint 0 does **not** apply to cloud builds.
- Verify `app/app.json` declares the permissions the flow needs (camera, media library, location) with Android-appropriate entries, and that `EXPO_PUBLIC_API_URL` can point the build at a reachable API host.
- Document the exact command sequence in `IMPLEMENTATION_PLAN.md` → Dev quick reference.
- **Fallback path**, also documented: USB-connected Android + Expo Go over LAN + `adb reverse tcp:4000 tcp:4000` so the device reaches the laptop's API at `localhost:4000`.

**Blocked-on:** an Expo account login and a physical Android device. If you cannot complete the cloud build, deliver the fully-configured `eas.json` + `app.json` + written command sequence + the `adb reverse` fallback, and report the blocker.

**Acceptance:** either an installable APK, or config + documented commands such that the user can run one command to produce one.

**Commit:** `chore(app): add EAS internal build profile and device-testing fallback`

---

## T2 — Re-gate the ₹25 cashback so the reward moment can actually fire

**Why:** Community corroboration is hardcoded 0, so only 4 signals are achievable, and `full` requires 4. A realistic demo post — UPI + geotagged photo + AI pass — lands at `partial` and pays nothing. The pitch's entire word-of-mouth thesis ("every user screenshots their cashback") is currently undemonstrable.

**Do:**
- In the reward path (`api/src/services/rewards.js` and/or the `POST /reviews` handler), replace the `tier === 'full'` gate on first-post cashback with a **presence-proof gate**: EXIF location verification passing **plus at least one** other passing signal.
- Express this as a named, documented predicate (e.g. `qualifiesForFirstPostCashback(signals)`), not an inline condition — it will change again.
- Keep it env-overridable in the existing `*_` env style so the threshold can be tuned without a code change.
- Add unit tests for the predicate: presence + 1 → qualifies; presence alone → does not; two non-presence signals → does not; already-claimed user → does not (idempotency).
- Confirm the post-submit modal in `app/App.tsx` surfaces the cashback, coin delta, and streak on this path.

**Acceptance:** a device post with real camera GPS at a seeded restaurant returns cashback in the `POST /reviews` response and shows the reward modal. Existing tests green.

**Commit:** `feat(reviews): gate first-post cashback on presence proof, not full tier`

---

## T3 — Seed demo restaurants for a deterministic on-stage run

**Why:** The demo must work indoors, on venue Wi-Fi, with poor GPS — and must be able to show the system saying **no**, which is more persuasive than showing it say yes.

**Do:**
- Add a **separate, clearly-named** seed script (e.g. `api/src/db/seed-demo.js` or `api/scripts/seed-demo-venue.js`) — do not modify the existing Bangalore `seed.js`.
- It takes venue lat/lng as CLI args and inserts:
  - **2–3 "venue" restaurants** at/near those coordinates, so a real device photo taken in the room genuinely passes the real haversine check. The code path stays real; only the seed data is chosen.
  - **1 "far" restaurant** ~5 km away, for the rejection demo: same photo, wrong restaurant → verification denied with a human-readable reason.
- Ensure the `POST /reviews` response and the app modal both surface the **per-signal reason strings** on failure, so the rejection is legible on screen and not just a missing badge.
- Document usage in Dev quick reference, including a worked example.

**Acceptance:** with the venue seed loaded, one device photo produces a passing verification at a venue restaurant and an explicit, readable denial at the far restaurant.

**Commit:** `chore(db): add demo venue seed script for on-device verification demo`

---

## T4 — Dataset visibility view

**Why:** The strategy doc's closing argument is that the verified review database *is* the asset. The current app shows a review feed, which reads as "another review app." One screen reframes it.

**Do:**
- Add a read-only aggregate endpoint (e.g. `GET /stats`) returning: total reviews by tier, verified vs unverified split, restaurant count, reviews per city, and a lightweight list of `{lat, lng, tier}` for plotting.
- Add a single screen or Profile-tab section in `app/App.tsx` rendering these as counts plus a simple visual. **Use only existing dependencies** — no map SDK, no chart library. An absolutely-positioned dot scatter on a plain container, or styled stat cards, is sufficient and on-brand.
- Style with existing `theme.ts` tokens and `typeScale`; reuse `tierColors` / `tierTextColors`.

**Acceptance:** one screen the founder can point at while saying "this is the asset, and it compounds."

**Commit:** `feat(app): add verified-dataset stats view`

---

## T5 — Demo resilience

**Why:** Venue network and indoor GPS will fail. The demo must degrade without looking broken.

**Do:**
- Audit every screen for a **visible, themed** error state on API failure with a retry — Sprint 4 added `ErrorState` to Feed/Search/detail/Leaderboard/Rewards; extend it to any screen added in T4 and to the post-submit path.
- Ensure `POST /reviews` never hangs indefinitely: bound the outbound Hive/OCR calls with a short timeout so a dead network cannot freeze the submit button mid-demo. Keep the existing fail-open behaviour, but make the timeout explicit and env-configurable.
- Confirm the API client's LAN-IP autodetection still resolves when the device is on a hotspot, and that `EXPO_PUBLIC_API_URL` cleanly overrides it.

**Acceptance:** with the API stopped, every screen shows a themed retry state and nothing spins forever.

**Commit:** `fix(app): harden error states and bound outbound verification timeouts`

---

## T6 — Boot guard on the dev OTP bypass

**Why:** `DEV_OTP_CODE=123456` accepts any phone number. One env misconfiguration during a demo or tester period is full account takeover of every account, including admin. Roughly an hour of work; stays in scope on severity alone.

**Do:**
- In `api/src/server.js` (or a small `config` validator it calls), **refuse to start** — log a clear fatal and `process.exit(1)` — if `NODE_ENV === 'production'` and `DEV_OTP_CODE` is set, or if the OTP bypass is otherwise enabled outside development.
- Log a loud, unmistakable startup warning whenever the bypass **is** active, so nobody ships it by accident.
- Add a unit test for the validator predicate (pure function, no server boot).

**Acceptance:** production config + dev OTP → process refuses to boot with a clear message. Dev unchanged.

**Commit:** `fix(api): refuse to boot with dev OTP bypass enabled in production`

---

## T7 — Stop serving raw EXIF to the public

**Why:** The pipeline preserves EXIF and serves `photo_url`. If that is the original file, Faven publishes users' precise GPS — including home coordinates when someone uploads an older camera-roll photo. This is the kind of finding that turns a trust-infrastructure pitch into a bad question in diligence.

**Do:**
- Keep the uploaded original **private** (not under any statically-served path) and serve a **stripped, resized rendition** as `photo_url`.
- Extract EXIF → verify → persist only what the product needs (distance in metres, timestamp delta, pass/fail, GPS accuracy if available). Do **not** persist raw coordinates in any column the API returns.
- Use `exifr` plus whatever image handling is already present. **If no resizer is available, do not add `sharp`** — re-encode via an existing dependency, or as a minimum strip the metadata and serve the file from a path with metadata removed. Report what you did.
- Verify the existing EXIF integration tests still pass against real geotagged JPEGs.

**Acceptance:** a geotagged upload still verifies correctly, and the publicly-served image contains no GPS.

**Commit:** `fix(reviews): strip EXIF from served photo renditions, keep originals private`

---

## T8 — Basic OTP rate limiting

**Why:** Cheap now, and the shape of the control is worth being able to describe on stage. Once a real SMS provider is wired, an unthrottled OTP endpoint is direct financial exposure (traffic pumping).

**Do:**
- Per-phone and per-IP request limits on `POST /auth/request-otp`, plus a verify-attempt counter and short OTP expiry.
- In-memory is acceptable at this stage — **do not introduce Redis**. Note the limitation in a code comment.
- Unit-test the limiter predicate.

**Acceptance:** rapid repeat OTP requests for one number are rejected with a clear status; normal login unaffected.

**Commit:** `feat(auth): add OTP request rate limiting and attempt counters`

---

## T9 — Mark every stub honestly in the docs

**Why:** This is the one integrity item. `README.md` currently presents Hive AI detection and ₹25 cashback as features without noting that the provider integration is env-gated/absent, that UTR is a 12-digit format check, that receipt OCR is a stub, and that the reward ledger is mock. Volunteering gaps gets better terms than having them discovered.

**Do:**
- In `README.md`, annotate each partially-implemented feature inline — e.g. `AI-generated photo detection via Hive *(stub — provider integration pending)*`, `UPI UTR *(format validation only — see Hardening Backlog)*`, `₹25 cashback *(mock ledger — Razorpay Payouts pending)*`, `receipt OCR *(stub)*`.
- Do the same in the API overview table where an endpoint's behaviour is stubbed.
- Change nothing about what the code does. This task is documentation only.

**Acceptance:** no reader of `README.md` could conclude a stub is a live integration.

**Commit:** `docs(infra): label stubbed integrations in README`

---

## T10 — Repo hygiene pass

**Why:** Sophisticated investors read repos. Stale docs read as a sloppy operator.

**Do:**
- `IMPLEMENTATION_PLAN.md`: refresh the **Last updated** header (currently 22 July, stale). Fix the Sprint 3 status marker — it says `⬅ IN PROGRESS` while every non-deferred item is ticked; mark it complete with the push-notifications item explicitly called out as deferred, matching how Sprint 2's EAS item is handled.
- Reconcile the README's "Sprints 0–4 complete" claim with the plan's markers so the two documents agree.
- Confirm the repository-layout section lists files that actually exist, including `Faven_Document.html` and `faven-landing_4.html` (both present — do not remove these references).

**Commit:** `docs(infra): sync sprint status and refresh plan metadata`

---

## T11 — Landing page waitlist (only if T1–T9 are done)

**Why:** Sprint 5 lists it, and a live waitlist form is a small credibility win if the landing page gets shown.

**Do:**
- `faven-landing_4.html` line ~725 has `joinWaitlist()` marked "demo only." Add `POST /waitlist` to the API (email validation, dedupe, store) and wire the form to it, keeping a graceful client-side success state if the API is unreachable.
- Do not restyle the page. Do not touch the theme switcher or the `data-theme="ember"` default.

**Commit:** `feat(api): add waitlist endpoint and wire landing page form`

---

## T12 — Create the diligence artifacts

**Why:** These two documents are worth more in a diligence conversation than another feature.

**Do:**

**A. `STATUS.md`** — a one-page **Built / Stubbed / Not started** table covering: phone OTP auth, restaurant search, review submission, EXIF verification, UTR verification, receipt OCR, Hive AI detection, community corroboration, tier computation, cashback, FAV Coins, streaks, voucher milestones, leaderboard, credibility score, moderation dashboard, search, push notifications, payouts, SMS provider, deployment. One line each, blunt, no marketing language.

**B. `HARDENING_BACKLOG.md`** — everything you deferred or noticed and did not fix, so the gap list is deliberate rather than unknown. Group under: Verification integrity (EXIF spoofing / in-app capture + Play Integrity, per-venue distance thresholds instead of a global 200 m, weighted confidence scoring replacing signal counting, UTR via RBI Account Aggregator), Security (JWT rotation/revocation, upload validation, admin audit log, admin 2FA), Payments (integer paise, double-entry, idempotency keys, payout caps, device+VPA fraud rules), Data & scale (Redis leaderboards, versioned migrations, S3, Places ToS on caching place data, search transliteration, credibility decay), Compliance (DPDP consent/erasure/retention, CCPA endorsement disclosure given that users are paid to post, IT Act §79 intermediary status), Process (CI on push, branch protection on `main`, adversarial test suite, analytics instrumentation).
- For each item: one line on the risk, one line on the fix. No essays.

**Commit:** `docs(infra): add STATUS and HARDENING_BACKLOG diligence artifacts`

---

## 3. Session close

When done, report back in this exact shape — nothing else:

1. **Completed** — task IDs with commit hashes.
2. **Blocked** — task IDs, one line each on what is needed from the user (device, Expo login, decision).
3. **Test status** — pass count before and after.
4. **Deviations** — anything you did differently from this brief, and why.
5. **Files added/changed** — paths only.

Do not summarise the product. Do not restate this brief.
