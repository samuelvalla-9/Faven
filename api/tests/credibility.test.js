const { computeCredibility, CRED_WEIGHTS } = require('../src/services/credibility');

describe('computeCredibility (v1)', () => {
  test('zero everything → 0', () => {
    expect(computeCredibility({}, 0)).toBe(0);
  });

  test('tier weights: full=10, partial=5, reviewed=1 (defaults)', () => {
    expect(computeCredibility({ full: 1 })).toBe(CRED_WEIGHTS.full);
    expect(computeCredibility({ partial: 1 })).toBe(CRED_WEIGHTS.partial);
    expect(computeCredibility({ reviewed: 1 })).toBe(CRED_WEIGHTS.reviewed);
  });

  test('mixed counts add up', () => {
    // 2*10 + 3*5 + 4*1 = 39
    expect(computeCredibility({ full: 2, partial: 3, reviewed: 4 })).toBe(39);
  });

  test('sponsored posts count at half weight', () => {
    // (2*10)/2 = 10
    expect(computeCredibility({ sponsoredFull: 2 })).toBe(10);
    // 10 + (1*5)/2 = 12.5 → rounds to 13
    expect(computeCredibility({ full: 1, sponsoredPartial: 1 })).toBe(13);
  });

  test('streak adds 1 pt/day capped at streakCap', () => {
    expect(computeCredibility({}, 3)).toBe(3);
    expect(computeCredibility({}, 25)).toBe(CRED_WEIGHTS.streakCap);
  });

  test('score is capped at max', () => {
    expect(computeCredibility({ full: 50 }, 10)).toBe(CRED_WEIGHTS.max);
  });

  test('handles stringy SQL SUM() values and nulls', () => {
    expect(computeCredibility({ full: '2', partial: null, reviewed: undefined }, '5')).toBe(25);
  });

  test('negative garbage clamped to 0', () => {
    expect(computeCredibility({ full: -3 }, -10)).toBe(0);
  });
});
