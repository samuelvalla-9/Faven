// Integration tests: real EXIF extraction (exifr) against generated geotagged JPEGs.
// Proves the full pipeline works — file → GPS/timestamp → distance/recency → verified.

const fs = require('fs');
const { extractExif, verifyExif } = require('../src/services/verification');
const { createGeotaggedJpeg } = require('./helpers/geotaggedJpeg');

// Truffles, Bangalore-ish coords used across seed data
const RESTAURANT = { lat: 12.9716, lng: 77.5946 };

const tempFiles = [];
function makePhoto(opts) {
  const file = createGeotaggedJpeg(opts);
  tempFiles.push(file);
  return file;
}

afterAll(() => {
  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch {}
  }
});

describe('EXIF extraction pipeline (real files)', () => {
  test('extractExif reads GPS coords back within ~1m precision', async () => {
    const file = makePhoto({ lat: 12.9716, lng: 77.5946, takenAt: new Date() });
    const exif = await extractExif(file);
    expect(exif.latitude).toBeCloseTo(12.9716, 4);
    expect(exif.longitude).toBeCloseTo(77.5946, 4);
    expect(exif.takenAt).toBeTruthy();
  });

  test('extractExif on photo without GPS returns undefined coords', async () => {
    const file = makePhoto({ takenAt: new Date() });
    const exif = await extractExif(file);
    expect(exif.latitude ?? undefined).toBeUndefined();
    expect(exif.longitude ?? undefined).toBeUndefined();
  });

  test('photo at the restaurant, taken now → verified', async () => {
    const file = makePhoto({ lat: 12.9716, lng: 77.5946, takenAt: new Date() });
    const r = await verifyExif(file, RESTAURANT);
    expect(r.verified).toBe(true);
    expect(r.distanceMeters).toBeLessThan(5);
  });

  test('photo ~150m away, recent → still verified (within 200m threshold)', async () => {
    const file = makePhoto({ lat: 12.9716 + 0.00135, lng: 77.5946, takenAt: new Date() });
    const r = await verifyExif(file, RESTAURANT);
    expect(r.verified).toBe(true);
    expect(r.distanceMeters).toBeGreaterThan(100);
    expect(r.distanceMeters).toBeLessThan(200);
  });

  test('photo ~2km away → rejected as too_far', async () => {
    const file = makePhoto({ lat: 12.99, lng: 77.5946, takenAt: new Date() });
    const r = await verifyExif(file, RESTAURANT);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('too_far');
  });

  test('photo at restaurant but taken 5 days ago → rejected as photo_too_old', async () => {
    const old = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    const file = makePhoto({ lat: 12.9716, lng: 77.5946, takenAt: old });
    const r = await verifyExif(file, RESTAURANT);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('photo_too_old');
  });

  test('GPS-stripped photo (browser upload scenario) → rejected as no_gps', async () => {
    const file = makePhoto({ takenAt: new Date() });
    const r = await verifyExif(file, RESTAURANT);
    expect(r.verified).toBe(false);
    expect(r.reasons).toContain('no_gps');
  });
});
