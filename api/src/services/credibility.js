// Credibility score v1 (Sprint 3)
// Simple, explainable formula: verified posts weighted by tier, plus a small
// streak signal, capped at 100. Recomputed from scratch on every post so it
// never drifts (idempotent — no incremental updates to go stale).
//
// Weights (env-overridable):
//   full     → 10 pts   (4–5 verification signals)
//   partial  → 5 pts    (2–3 signals)
//   reviewed → 1 pt     (0–1 signals, AI scan only)
//   streak   → +1 pt per active streak day, capped at 10
//   sponsored posts count at half weight (disclosed transparently, but a lower trust signal)

const W = {
  full: Number(process.env.CRED_W_FULL || 10),
  partial: Number(process.env.CRED_W_PARTIAL || 5),
  reviewed: Number(process.env.CRED_W_REVIEWED || 1),
  streakCap: Number(process.env.CRED_STREAK_CAP || 10),
  max: Number(process.env.CRED_MAX || 100),
};

/**
 * Compute credibility from tier counts + streak. Pure & unit-testable.
 * @param {{ full?: number, partial?: number, reviewed?: number, sponsoredFull?: number, sponsoredPartial?: number, sponsoredReviewed?: number }} counts
 * @param {number} [streakDays]
 * @returns {number} 0..CRED_MAX integer
 */
function computeCredibility(counts = {}, streakDays = 0) {
  const n = (v) => Math.max(0, Number(v) || 0);
  const organic =
    n(counts.full) * W.full + n(counts.partial) * W.partial + n(counts.reviewed) * W.reviewed;
  const sponsored =
    (n(counts.sponsoredFull) * W.full +
      n(counts.sponsoredPartial) * W.partial +
      n(counts.sponsoredReviewed) * W.reviewed) / 2;
  const streakPts = Math.min(W.streakCap, n(streakDays));
  return Math.min(W.max, Math.round(organic + sponsored + streakPts));
}

/**
 * Recompute and persist a user's credibility_score from their reviews.
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} userId
 * @returns {Promise<number>} the new score
 */
async function recomputeCredibility(pool, userId) {
  const [[row]] = await pool.query(
    `SELECT
       SUM(verification_tier='full'     AND is_sponsored=0) AS full,
       SUM(verification_tier='partial'  AND is_sponsored=0) AS partial,
       SUM(verification_tier='reviewed' AND is_sponsored=0) AS reviewed,
       SUM(verification_tier='full'     AND is_sponsored=1) AS sponsoredFull,
       SUM(verification_tier='partial'  AND is_sponsored=1) AS sponsoredPartial,
       SUM(verification_tier='reviewed' AND is_sponsored=1) AS sponsoredReviewed
     FROM reviews WHERE user_id=?`,
    [userId]
  );
  const [[user]] = await pool.query(`SELECT streak_days FROM users WHERE id=?`, [userId]);
  const score = computeCredibility(row || {}, user?.streak_days || 0);
  await pool.query(`UPDATE users SET credibility_score=? WHERE id=?`, [score, userId]);
  return score;
}

module.exports = { computeCredibility, recomputeCredibility, CRED_WEIGHTS: W };
