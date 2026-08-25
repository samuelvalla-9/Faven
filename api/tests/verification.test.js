// Unit tests for the verification service (Sprint 2)
const {
  computeTier,
  haversineMeters,
  evaluateExif,
  verifyUpi,
  verifyReceipt,
  verifyAiAuthenticity,
  verifyExif,
  verifyCommunityCorroboration,
} = require('../src/services/verification');

describe('computeTier', () => {
  const base = { exif_verified: 0, upi_verified: 0, receipt_verified: 0, ai_authentic: 0, community_verified: 0 };
  test('0 signals → reviewed', () => expect(computeTier(base)).toBe('reviewed'));
  test('1 signal → reviewed', () => expect(computeTier({ ...base, ai_authentic: 1 })).toBe('reviewed'));
  test('2 signals → partial', () => expect(computeTier({ ...base, ai_authentic: 1, exif_verified: 1 })).toBe('partial'));
  test('3 signals → partial', () => expect(computeTier({ ...base, ai_authentic: 1, exif_verified: 1, upi_verified: 1 })).toBe('partial'));
  test('4 signals → full', () => expect(computeTier({ ...base, ai_authentic: 1, exif_verified: 1, upi_verified: 1, receipt_verified: 1 })).toBe('full'));
  test('5 signals → full', () => expect(computeTier({ exif_verified: 1, upi_verified: 1, receipt_verified: 1, ai_authentic: 1, community_verified: 1 })).toBe('full'));
});

describe('haversineMeters', () => {
  test('zero distance for same point', () => {
    expect(haversineMeters(12.9716, 77.5946, 12.9716, 77.5946)).toBeCloseTo(0);
  });
  test('~111km per degree of latitude', () => {
    const d = haversineMeters(12.0, 77.0, 13.0, 77.0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
  test('short distance accuracy (~150m)', () => {
    // ~0.00135 deg latitude ≈ 150m
    const d = haversineMeters(12.9716, 77.5946, 12.9716 + 0.00135, 77.5946);
    expect(d).toBeGreaterThan(140);
    expect(d).toBeLessThan(160);
  });
});

describe('evaluateExif', () => {
  const restaurant = { lat: 12.9716, lng: 77.5946 };
  const now = new Date('2026-07-20T12:00:00Z');

  test('no GPS → not verified', () => {
    const r = evaluateExif({ latitude: null, longitude: null, takenAt: null }, restaurant, now);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('no_gps');
  });

  test('restaurant missing coords → not verified', () => {
    const r = evaluateExif({ latitude: 12.9716, longitude: 77.5946 }, { lat: null, lng: null }, now);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('restaurant_missing_coords');
  });

  test('within 200m and recent timestamp → verified', () => {
    const r = evaluateExif(
      { latitude: 12.9720, longitude: 77.5946, takenAt: new Date('2026-07-20T10:00:00Z') },
      restaurant, now
    );
    expect(r.verified).toBe(true);
    expect(r.distanceMeters).toBeLessThan(200);
  });

  test('too far (>200m) → not verified', () => {
    const r = evaluateExif(
      { latitude: 12.9916, longitude: 77.5946, takenAt: new Date('2026-07-20T10:00:00Z') },
      restaurant, now
    );
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('too_far');
  });

  test('photo too old (>72h) → not verified', () => {
    const r = evaluateExif(
      { latitude: 12.9716, longitude: 77.5946, takenAt: new Date('2026-07-10T10:00:00Z') },
      restaurant, now
    );
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('photo_too_old');
  });

  test('timestamp in future → not verified', () => {
    const r = evaluateExif(
      { latitude: 12.9716, longitude: 77.5946, takenAt: new Date('2026-07-21T12:00:00Z') },
      restaurant, now
    );
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('timestamp_in_future');
  });

  test('GPS match without timestamp → verified with no_timestamp note', () => {
    const r = evaluateExif({ latitude: 12.9716, longitude: 77.5946, takenAt: null }, restaurant, now);
    expect(r.verified).toBe(true);
    expect(r.reasons).toContain('no_timestamp');
  });
});

describe('verifyExif (file IO wrapper)', () => {
  test('no photo → not verified', async () => {
    const r = await verifyExif(null, { lat: 12.9, lng: 77.5 });
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('no_photo');
  });
});

describe('verifyUpi', () => {
  test('missing UTR → not verified', async () => {
    expect((await verifyUpi(null)).verified).toBe(false);
  });
  test('invalid format → not verified', async () => {
    expect((await verifyUpi('abc123')).verified).toBe(false);
    expect((await verifyUpi('12345')).verified).toBe(false);
  });
  test('valid 12-digit UTR → verified (dev mock)', async () => {
    const r = await verifyUpi('123456789012');
    expect(r.verified).toBe(true);
  });
});

describe('verifyReceipt', () => {
  test('no receipt → not verified', async () => {
    expect((await verifyReceipt(null)).verified).toBe(false);
  });
  test('receipt present → still stubbed false (OCR not implemented)', async () => {
    expect((await verifyReceipt('/tmp/receipt.jpg', {})).verified).toBe(false);
  });
});

describe('verifyAiAuthenticity', () => {
  test('no photo → not verified', async () => {
    expect((await verifyAiAuthenticity(null)).verified).toBe(false);
  });
  test('photo present in dev (no HIVE_API_KEY) → verified stub', async () => {
    delete process.env.HIVE_API_KEY;
    expect((await verifyAiAuthenticity('/tmp/photo.jpg')).verified).toBe(true);
  });
  test('provider error with HIVE_API_KEY → fail open (verified, reason noted)', async () => {
    process.env.HIVE_API_KEY = 'test-key';
    try {
      // nonexistent file → readFileSync throws → fail-open path
      const r = await verifyAiAuthenticity('/nonexistent/photo.jpg');
      expect(r.verified).toBe(true);
      expect(r.reasons).toContain('provider_error_fail_open');
    } finally {
      delete process.env.HIVE_API_KEY;
    }
  });
});

describe('evaluateHiveResponse', () => {
  const { evaluateHiveResponse } = require('../src/services/verification');
  const hiveJson = (score) => ({
    status: [{ response: { output: [{ classes: [{ class: 'ai_generated', score }, { class: 'not_ai_generated', score: 1 - score }] }] } }],
  });

  test('low ai_generated score → verified', () => {
    const r = evaluateHiveResponse(hiveJson(0.05));
    expect(r.verified).toBe(true);
    expect(r.aiGenScore).toBe(0.05);
    expect(r.reasons).toContain('hive_check_passed');
  });
  test('score at/above threshold → not verified', () => {
    const r = evaluateHiveResponse(hiveJson(0.95));
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('ai_generated_detected');
  });
  test('custom threshold respected', () => {
    expect(evaluateHiveResponse(hiveJson(0.5), 0.4).verified).toBe(false);
    expect(evaluateHiveResponse(hiveJson(0.5), 0.6).verified).toBe(true);
  });
  test('flat output shape (no status wrapper) also parsed', () => {
    const r = evaluateHiveResponse({ output: [{ classes: [{ class: 'ai_generated', score: 0.1 }] }] });
    expect(r.verified).toBe(true);
  });
  test('malformed response → not verified with unexpected_response', () => {
    expect(evaluateHiveResponse({}).reasons).toContain('unexpected_response');
    expect(evaluateHiveResponse({ status: [{ response: { output: [{ classes: [] }] } }] }).reasons).toContain('unexpected_response');
    expect(evaluateHiveResponse(null).reasons).toContain('unexpected_response');
  });
});

describe('verifyCommunityCorroboration', () => {
  // Mock pool that returns controlled count values
  const mockPool = (count) => ({
    query: jest.fn().mockResolvedValue([[{ count }]]),
  });

  test('corroboration present (count > 0) → verified', async () => {
    const r = await verifyCommunityCorroboration(mockPool(2), 100, 1);
    expect(r.verified).toBe(true);
    expect(r.corroboratingReviews).toBe(2);
    expect(r.reasons).toContain('corroboration_found');
  });

  test('corroboration absent (count = 0) → not verified', async () => {
    const r = await verifyCommunityCorroboration(mockPool(0), 100, 1);
    expect(r.verified).toBe(false);
    expect(r.corroboratingReviews).toBe(0);
    expect(r.reasons).toContain('no_corroboration');
  });

  test('no pool → not verified', async () => {
    const r = await verifyCommunityCorroboration(null, 100, 1);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('invalid_params');
  });

  test('no restaurantId → not verified', async () => {
    const r = await verifyCommunityCorroboration(mockPool(0), null, 1);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('invalid_params');
  });

  test('query excludes posting user (userId in WHERE)', async () => {
    const pool = mockPool(1);
    await verifyCommunityCorroboration(pool, 100, 5);
    // Verify the query was called with userId excluded
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('user_id != ?'),
      expect.arrayContaining([100, 5])
    );
  });

  test('query filters by status != removed', async () => {
    const pool = mockPool(1);
    await verifyCommunityCorroboration(pool, 100, 1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("status != 'removed'"),
      expect.anything()
    );
  });

  test('query filters by exif_verified = 1', async () => {
    const pool = mockPool(1);
    await verifyCommunityCorroboration(pool, 100, 1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('exif_verified = 1'),
      expect.anything()
    );
  });

  test('query uses COMMUNITY_WINDOW_DAYS', async () => {
    const pool = mockPool(1);
    await verifyCommunityCorroboration(pool, 100, 1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('DATE_SUB'),
      expect.arrayContaining([7]) // default window
    );
  });
});
