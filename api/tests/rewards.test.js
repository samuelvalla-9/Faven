const { computeStreak, STREAK_WEEKLY_BONUS_COINS } = require('../src/services/rewards');

const TODAY = '2026-07-20';

describe('computeStreak', () => {
  test('first post ever starts streak at 1', () => {
    expect(computeStreak(null, 0, TODAY)).toEqual({ streakDays: 1, changed: true, weeklyBonus: 0 });
  });

  test('posted yesterday → streak increments', () => {
    expect(computeStreak('2026-07-19', 3, TODAY)).toEqual({ streakDays: 4, changed: true, weeklyBonus: 0 });
  });

  test('gap of 2+ days resets streak to 1', () => {
    expect(computeStreak('2026-07-17', 12, TODAY)).toEqual({ streakDays: 1, changed: true, weeklyBonus: 0 });
  });

  test('already posted today → unchanged, no double count', () => {
    expect(computeStreak(TODAY, 5, TODAY)).toEqual({ streakDays: 5, changed: false, weeklyBonus: 0 });
  });

  test('posted today but streak stored as 0 → coerced to 1', () => {
    expect(computeStreak(TODAY, 0, TODAY)).toEqual({ streakDays: 1, changed: false, weeklyBonus: 0 });
  });

  test('weekly bonus fires when streak hits 7', () => {
    const r = computeStreak('2026-07-19', 6, TODAY);
    expect(r.streakDays).toBe(7);
    expect(r.weeklyBonus).toBe(STREAK_WEEKLY_BONUS_COINS);
  });

  test('weekly bonus fires again at 14', () => {
    const r = computeStreak('2026-07-19', 13, TODAY);
    expect(r.streakDays).toBe(14);
    expect(r.weeklyBonus).toBe(STREAK_WEEKLY_BONUS_COINS);
  });

  test('no bonus on non-multiples of 7', () => {
    expect(computeStreak('2026-07-19', 7, TODAY).weeklyBonus).toBe(0);
  });

  test('no bonus when already posted today even at 7', () => {
    expect(computeStreak(TODAY, 7, TODAY).weeklyBonus).toBe(0);
  });

  test('accepts Date objects for last_post_date (MySQL driver returns Dates)', () => {
    const r = computeStreak(new Date('2026-07-19T00:00:00'), 2, TODAY);
    expect(r).toEqual({ streakDays: 3, changed: true, weeklyBonus: 0 });
  });

  test('reset to 1 does not fire a bonus even if 1 % 7 logic misused (sanity)', () => {
    expect(computeStreak('2026-07-01', 6, TODAY)).toEqual({ streakDays: 1, changed: true, weeklyBonus: 0 });
  });

  test('handles month/year boundaries', () => {
    expect(computeStreak('2026-06-30', 4, '2026-07-01').streakDays).toBe(5);
    expect(computeStreak('2025-12-31', 4, '2026-01-01').streakDays).toBe(5);
  });
});
