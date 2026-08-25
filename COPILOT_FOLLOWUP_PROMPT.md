# Copilot Agent Task Brief — Faven Follow-Up Pass (Session 2)

**Paste this whole file to the coding agent as the session brief.**

---

## 0. Context

Session 1 executed the demo-hardening brief and produced `STATUS.md` and `HARDENING_BACKLOG.md`. Review of those artifacts found one probable demo-breaking defect, several inaccuracies where the two documents contradict each other or the code, and a set of missing backlog entries.

This session fixes those. Same framing as before: **the target is a live investor demo on a physical Android phone plus clean technical diligence** — not production readiness.

**Before starting, report the Session 1 close-out that was not delivered:** which of T1–T12 completed, which were skipped or blocked, and the test count before and after. Do not begin F-tasks until that is stated.

---

## 1. Hard constraints

Unchanged from Session 1, restated because they bind here too:

- **No refactors.** No expo-router, no react-query, no splitting `app/App.tsx`, no Redis, no S3, no migration framework, no JWT refresh flow.
- **No new npm dependencies** unless a task names one. If you think one is unavoidable, stop and ask.
- Follow `GIT_PROTOCOL.md`: per-repo identity check before the first commit, Conventional Commits, **one task = one commit**, push after each, no force-push, no `git add -f`, `git check-ignore api/.env` before staging.
- Run `cd api; npm test` after every task. Report the count each time. Tests must stay green; if a task legitimately invalidates a test, fix the test and say so in the commit body.
- Update `IMPLEMENTATION_PLAN.md` in this session per the protocol's documentation-upkeep rules.
- **If a task is blocked, stop and report it in one line.** Do not substitute a mock that looks like a working integration.

**Do not touch** `Faven_Document.html` or `faven-landing_4.html` in this session.

---

## F0 — GATING: finish the device build

**This is the only task that matters if you can only do one.** `STATUS.md` lists EAS Build as "Config only," which means the verification differentiator has never run against a real camera. Every "Built" claim about EXIF is currently validated only against synthetic fixtures.

**Do:**
- Run the EAS cloud build using the `eas.json` internal/APK profile from Session 1 and produce an installable artifact. EAS builds run in Expo's cloud — the corporate-machine firewall/admin blocker does not apply.
- If the Expo account login cannot be completed in this session, execute the documented fallback instead: physical Android over USB + Expo Go + `adb reverse tcp:4000 tcp:4000`, and confirm the device reaches the API.
- Either way, run **one real post with a real camera photo** end to end and report the actual returned `verification` object verbatim — tier, signals, and per-signal reasons.

**Acceptance:** a real device photo has traversed the real pipeline, and the actual response is pasted into your report.

**Blocked-on:** Expo account login and/or a physical Android device. Report immediately if unavailable.

**Commit:** none required unless config changes were needed.

---

## F1 — Make "Fully Verified" reachable (probable demo-breaker)

**Why:** Per `STATUS.md`, receipt OCR is a stub returning `ocr_not_implemented` and community corroboration always returns 0. That leaves three passable signals — EXIF, UTR format check, AI stub — while `full` requires four. **The badge the entire pitch rests on cannot appear on stage.**

**Do:**
1. **First, verify the defect.** Write a test that submits a post with every achievable signal passing and assert the resulting tier. Report the actual tier. If `full` is genuinely reachable, stop here, report that, and skip to F2.
2. If confirmed, fix by implementing **community corroboration** as a real minimal signal — not by lowering the threshold:
   - Pass when ≥1 other user has a non-removed, location-verified review of the same restaurant within a configurable window (env, default 7 days). Exclude the posting user's own reviews.
   - Live in `api/src/services/verification.js` alongside the other `verify*` functions, following their existing shape and reason-string convention.
   - Unit tests: corroboration present, absent, self-reviews excluded, removed reviews excluded, outside window.
   - This is the viral mechanic from the strategy doc, so it is also worth demoing in its own right.
3. **Do not lower the `full` threshold from 4 signals.** Inflating the badge to fit the stubs is exactly what a technical reviewer catches, and it undermines the one claim the product sells.
4. Make the demo venue seed (Session 1 T3) insert a pre-existing corroborating review at each venue restaurant so the signal fires on the first live post.

**Acceptance:** a real device photo at a seeded venue restaurant returns tier `full`, and the reward modal shows the ₹25 cashback.

**Commit:** `feat(verification): implement community corroboration signal`

---

## F2 — Correct `STATUS.md`

Documentation only — change no behaviour. Verify each claim against the code before editing; if the code disagrees with what is written below, report it.

- **Tier computation** — the note says "weighted by signal presence," implying weighted scoring, while `HARDENING_BACKLOG.md` lists weighted scoring as an open item. The two documents contradict each other. Change to state plainly that it is an **unweighted signal count**.
- **EXIF privacy** — `piexifjs` handles JPEG only. Confirm and then state the behaviour for **PNG and HEIC** uploads, and note that **XMP/IPTC** blocks can also carry GPS and are not removed by an EXIF strip. Also confirm the originals directory is genuinely not under any statically-served path, and say so.
- **First-post cashback** — add that it is **once per user and idempotent** (verify this is true; if it is not, that is a bug — report it).
- **Merge the duplicate rows** — "Restaurant search" and "Search" both cover the same endpoint surface.
- **Add missing rows** for anything Session 1 shipped that is absent: demo venue seed, error-state/timeout hardening, and any other T-task deliverable not represented.
- Refresh **Last updated**.

**Commit:** `docs(infra): correct STATUS accuracy and add missing rows`

---

## F3 — Fix the demo-day rate limit

**Why:** Per-IP 10/min means every investor behind the venue NAT shares one bucket. If two people try logging in on the same Wi-Fi, the second is throttled mid-demo.

**Do:**
- Make both limits env-configurable (per-phone and per-IP separately).
- Raise the **per-IP** default substantially or exempt private/LAN ranges; keep the **per-phone** limit tight, since that is the control that actually matters for SMS-pumping cost.
- Note the tradeoff in a code comment.

**Acceptance:** several distinct phone numbers can log in from one IP in quick succession; repeat requests for a single number are still rejected.

**Commit:** `fix(auth): make OTP rate limits configurable and NAT-tolerant`

---

## F4 — Correct `HARDENING_BACKLOG.md`

Three items are wrong or muddled. Documentation only.

1. **"CCPA endorsement disclosure" misidentifies the risk.** The entry describes US FTC rules gated on "if US users participate." The applicable authority is India's **Central Consumer Protection Authority** endorsement guidelines (2023) plus **BIS IS 19000:2022** on online consumer review platforms. It applies **now, domestically**, because Faven pays every first-time poster: that is a material connection arguably requiring disclosure on **every rewarded review**, not only sponsored ones. Rewrite the item under a correct heading with that risk and fix.
2. **UTR item has a stray clause** — "Once SMS pumping is live, fake UTRs paired with real EXIF bypasses credibility." SMS pumping belongs to the OTP endpoint and is unrelated. Remove it and state the actual risk: an invented UTR paired with a real geotagged photo yields two signals and a Partially Verified badge at zero cost.
3. **Weighted scoring item** — keep the illustrative percentages but add the load-bearing part: **persist raw per-signal evidence** (distance in metres, timestamp delta, GPS accuracy, AI-generation probability, OCR match confidence) rather than booleans, so historical posts can be re-scored when weights change. They will change.

**Commit:** `docs(infra): correct compliance and verification backlog entries`

---

## F5 — Add missing backlog entries

Append to `HARDENING_BACKLOG.md` in the existing **Risk → Fix** format, under the existing category headings.

**Verification integrity**
- **UTR uniqueness** — no dedupe exists, so one UTR is reusable across posts and across users; collides directly with bill-splitting and the corroboration signal. Fix: unique index plus a per-user reuse check.
- **Photo replay** — the same geotagged photo can farm unlimited posts. Fix: perceptual hash (pHash/dHash) every upload; reject reuse across users and restaurants.
- **Timestamp window too wide** — 72 h means "walked past Monday, posted Thursday" passes. Fix: tighten to hours; treat low GPS accuracy as inconclusive rather than pass/fail.
- **File forensics** — cheap detection of lazy EXIF spoofing without full attestation. Fix: check JPEG quantization tables and EXIF tag ordering against known camera profiles, missing MakerNotes, thumbnail/main mismatch, editor `Software` tags.
- **Hive fail-open is invisible** — a provider timeout is indistinguishable from a pass, so the signal is defeatable by making the provider unreachable. Fix: persist `pass | fail | unavailable`, surface "couldn't verify," add a retry queue.

**Data & scale**
- **Moderation rewrites leaderboard history** — `prev_rank` recomputed live means removing a review retroactively alters last month's standings. Fix: snapshot monthly standings to a table.
- **Streak day boundary** — an unpinned day boundary leaves a 5.5-hour ambiguous window against UTC. Fix: pin explicitly to Asia/Kolkata.

**Compliance**
- **DPDP children's provisions** — the strategy doc explicitly targets students, pulling in under-18 rules. Fix: age gate, verifiable parental consent, no behavioural targeting at minors.
- **Payout KYC / AML** — mass small transfers to unverified recipients will trigger provider review and account freezes. Fix: recipient KYC, threshold monitoring, reconciliation before scaling payouts.
- **NPCI / UPI branding rules** — constrain how a non-payment app may reference UPI in product and marketing. Fix: legal review of all UPI references in app copy and the landing page.

**Security**
- **Injection audit** — confirm `/search` and `/restaurants?q=` are parameterized throughout; string-built `LIKE`/`MATCH` clauses are the classic hole. Fix: audit and parameterize; add helmet, a CORS allowlist, and body size limits.

**Commit:** `docs(infra): add missing hardening backlog items`

---

## F6 — Verify repo state

Not a code change. Run and report output:

```powershell
cd api; npm test                    # report the count
git log --oneline -20               # one commit per task, Conventional Commits?
git config user.email               # must be samuelvalla-9@users.noreply.github.com
git status                          # expect up to date with origin/main
git check-ignore api/.env           # must print the path
```

Report anything anomalous: commits authored by the org identity, batched task commits, unpushed work, or `.env` not ignored.

---

## 2. Session close

Report in exactly this shape, nothing else:

1. **Session 1 close-out** — which of T1–T12 completed / skipped / blocked, and the test count delta.
2. **F0 result** — the verbatim `verification` object from the real device post, or the blocker.
3. **F1 finding** — the tier actually returned before the fix, and after.
4. **Completed** — F-task IDs with commit hashes.
5. **Blocked** — F-task IDs, one line each on what is needed from the user.
6. **Test status** — before and after.
7. **Deviations** — anything done differently from this brief, and why.
8. **Files changed** — paths only.

Do not summarise the product. Do not restate this brief.
