// Rewards / streak logic (Sprint 3)
// Pure functions so they're unit-testable without a DB.

const STREAK_WEEKLY_BONUS_COINS = Number(process.env.STREAK_WEEKLY_BONUS_COINS || 50);

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

module.exports = { computeStreak, STREAK_WEEKLY_BONUS_COINS };
