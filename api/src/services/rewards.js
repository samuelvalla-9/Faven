// Rewards / streak logic (Sprint 3)
// Pure functions so they're unit-testable without a DB.

const STREAK_WEEKLY_BONUS_COINS = Number(process.env.STREAK_WEEKLY_BONUS_COINS || 50);

// First-post cashback gate: presence proof (EXIF location) + at least N other signals.
// Env override: CASHBACK_MIN_OTHER_SIGNALS (default 1)
const CASHBACK_MIN_OTHER_SIGNALS = Number(process.env.CASHBACK_MIN_OTHER_SIGNALS || 1);

/**
 * Determines if a post qualifies for the ₹25 first-post cashback.
 * Requires presence proof (exif_verified) PLUS at least CASHBACK_MIN_OTHER_SIGNALS
 * additional passing signals.
 *
 * @param {{ exif_verified: number, upi_verified: number, receipt_verified: number, ai_authentic: number, community_verified: number }} signals
 * @returns {boolean}
 */
function qualifiesForFirstPostCashback(signals) {
  // Presence proof is mandatory
  if (!signals.exif_verified) return false;

  // Count other passing signals (excluding exif)
  const otherSignals =
    (signals.upi_verified ? 1 : 0) +
    (signals.receipt_verified ? 1 : 0) +
    (signals.ai_authentic ? 1 : 0) +
    (signals.community_verified ? 1 : 0);

  return otherSignals >= CASHBACK_MIN_OTHER_SIGNALS;
}

/** Normalize a DATE-ish value (Date, 'YYYY-MM-DD' string, null) to 'YYYY-MM-DD' or null. */
function toDateStr(d) {
  if (!d) return null;
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

/** Difference in whole days between two 'YYYY-MM-DD' strings (b - a). */
function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Compute the user's new streak after posting today.
 * Rules:
 *  - first post ever, or gap > 1 day → streak resets to 1
 *  - posted yesterday → streak + 1
 *  - already posted today → streak unchanged (no double count)
 * A weekly bonus fires every time the streak crosses a multiple of 7
 * (7, 14, 21, ...) — i.e. only on the day the streak *increments* onto it.
 *
 * @param {Date|string|null} lastPostDate user's last_post_date
 * @param {number} currentStreak user's streak_days
 * @param {Date|string} [today] override for tests
 * @returns {{ streakDays: number, changed: boolean, weeklyBonus: number }}
 */
function computeStreak(lastPostDate, currentStreak, today = new Date()) {
  const todayStr = toDateStr(today);
  const lastStr = toDateStr(lastPostDate);
  const streak = Math.max(0, Number(currentStreak) || 0);

  if (lastStr === todayStr) {
    return { streakDays: Math.max(1, streak), changed: false, weeklyBonus: 0 };
  }

  const next = lastStr && dayDiff(lastStr, todayStr) === 1 ? streak + 1 : 1;
  const weeklyBonus = next > 0 && next % 7 === 0 ? STREAK_WEEKLY_BONUS_COINS : 0;
  return { streakDays: next, changed: true, weeklyBonus };
}

// Voucher milestones (Sprint 3 — data model only; redemption deferred).
// Thresholds are lifetime post counts; values are the voucher ₹ amounts.
const VOUCHER_MILESTONES = [
  { threshold: 5, valueInr: 100 },
  { threshold: 10, valueInr: 250 },
  { threshold: 20, valueInr: 600 },
];

/**
 * Which milestone (if any) does this post cross?
 * Fires only on the exact post that reaches the threshold.
 * @param {number} totalPosts lifetime post count INCLUDING the post just made
 * @returns {{ threshold: number, valueInr: number } | null}
 */
function milestoneForPostCount(totalPosts) {
  const n = Number(totalPosts) || 0;
  return VOUCHER_MILESTONES.find((m) => m.threshold === n) || null;
}

module.exports = { computeStreak, milestoneForPostCount, qualifiesForFirstPostCashback, VOUCHER_MILESTONES, STREAK_WEEKLY_BONUS_COINS, CASHBACK_MIN_OTHER_SIGNALS };
