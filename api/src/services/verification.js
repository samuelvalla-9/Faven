// Verification service — Sprint 2: real EXIF GPS/timestamp verification.
// Tier rules (per product doc): 4-5 signals = full, 2-3 = partial, else reviewed.

const exifr = require('exifr');

// Config (env-overridable)
const MAX_DISTANCE_METERS = Number(process.env.EXIF_MAX_DISTANCE_M || 200);
const MAX_PHOTO_AGE_HOURS = Number(process.env.EXIF_MAX_AGE_HOURS || 72);

function computeTier(signals) {
  const count =
    (signals.exif_verified ? 1 : 0) +
    (signals.upi_verified ? 1 : 0) +
    (signals.receipt_verified ? 1 : 0) +
    (signals.ai_authentic ? 1 : 0) +
    (signals.community_verified ? 1 : 0);
  if (count >= 4) return 'full';
  if (count >= 2) return 'partial';
  return 'reviewed';
}

// Haversine distance in meters between two lat/lng points
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Extract GPS + capture timestamp from a photo file.
// Returns { latitude, longitude, takenAt } (any field may be undefined/null).
async function extractExif(photoPath) {
  try {
    const data = await exifr.parse(photoPath, { gps: true, pick: ['DateTimeOriginal', 'CreateDate'] });
    const gps = await exifr.gps(photoPath).catch(() => null);
    return {
      latitude: gps?.latitude ?? data?.latitude,
      longitude: gps?.longitude ?? data?.longitude,
      takenAt: data?.DateTimeOriginal || data?.CreateDate || null,
    };
  } catch {
    return { latitude: undefined, longitude: undefined, takenAt: null };
  }
}

// Evaluate EXIF evidence against a restaurant's coordinates.
// Pure logic — separated from file IO for testability.
function evaluateExif(exif, restaurant, now = new Date()) {
  const result = { verified: false, distanceMeters: null, ageHours: null, reasons: [] };

  if (exif.latitude == null || exif.longitude == null) {
    result.reasons.push('no_gps');
    return result;
  }
  if (restaurant?.lat == null || restaurant?.lng == null) {
    result.reasons.push('restaurant_missing_coords');
    return result;
  }

  result.distanceMeters = haversineMeters(
    exif.latitude, exif.longitude,
    Number(restaurant.lat), Number(restaurant.lng)
  );
  if (result.distanceMeters > MAX_DISTANCE_METERS) {
    result.reasons.push('too_far');
    return result;
  }

  if (exif.takenAt) {
    const taken = new Date(exif.takenAt);
    result.ageHours = (now.getTime() - taken.getTime()) / 36e5;
    if (result.ageHours < -1) {
      result.reasons.push('timestamp_in_future');
      return result;
    }
    if (result.ageHours > MAX_PHOTO_AGE_HOURS) {
      result.reasons.push('photo_too_old');
      return result;
    }
  } else {
    result.reasons.push('no_timestamp'); // GPS match alone still counts
  }

  result.verified = true;
  return result;
}

// Full EXIF verification for an uploaded photo against a restaurant.
async function verifyExif(photoPath, restaurant) {
  if (!photoPath) return { verified: false, reasons: ['no_photo'] };
  const exif = await extractExif(photoPath);
  return evaluateExif(exif, restaurant);
}

// UPI UTR verification — interface defined; real payment-provider check in Phase 2.
// Request field: `utr` (12-digit numeric UPI transaction reference).
// Dev rule: format-valid UTR counts as verified (mock), real API env-gated later.
async function verifyUpi(utr) {
  if (!utr) return { verified: false, reasons: ['no_utr'] };
  const clean = String(utr).trim();
  if (!/^\d{12}$/.test(clean)) return { verified: false, reasons: ['invalid_format'] };
  if (process.env.UPI_PROVIDER_API_KEY) {
    // TODO Phase 2: call real provider to confirm UTR belongs to the restaurant's VPA
    return { verified: false, reasons: ['provider_not_implemented'] };
  }
  return { verified: true, reasons: ['dev_format_check'] };
}

// Receipt OCR verification — interface defined; real OCR in Sprint 4+.
// Request file field: `receipt` (photo of the bill).
async function verifyReceipt(receiptPath, _restaurant) {
  if (!receiptPath) return { verified: false, reasons: ['no_receipt'] };
  // TODO: OCR (e.g. tesseract / cloud vision), match restaurant name + date + amount
  return { verified: false, reasons: ['ocr_not_implemented'] };
}

// ---- Community corroboration (Sprint 5 — F1 fix) ----
// Signal passes when ≥1 other user has a non-removed, location-verified review
// of the same restaurant within a configurable window (default 7 days).
// Excludes the posting user's own reviews. This is the viral mechanic.

const COMMUNITY_WINDOW_DAYS = Number(process.env.COMMUNITY_WINDOW_DAYS || 7);

/**
 * Check if another user has posted a location-verified review of the same
 * restaurant recently. Requires database pool and IDs.
 *
 * @param {object} pool - mysql2/promise pool
 * @param {number} restaurantId - target restaurant
 * @param {number} userId - posting user (excluded from search)
 * @returns {Promise<{verified: boolean, corroboratingReviews: number, reasons: string[]}>}
 */
async function verifyCommunityCorroboration(pool, restaurantId, userId) {
  if (!pool || !restaurantId) {
    return { verified: false, corroboratingReviews: 0, reasons: ['invalid_params'] };
  }

  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count FROM reviews
     WHERE restaurant_id = ?
       AND user_id != ?
       AND status != 'removed'
       AND exif_verified = 1
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [restaurantId, userId || 0, COMMUNITY_WINDOW_DAYS]
  );

  if (count > 0) {
    return { verified: true, corroboratingReviews: count, reasons: ['corroboration_found'] };
  }
  return { verified: false, corroboratingReviews: 0, reasons: ['no_corroboration'] };
}

// ---- AI photo authenticity (Sprint 4) ----
// Provider: Hive AI-generated media detection (env-gated via HIVE_API_KEY).
// Without a key, dev stub passes photos as authentic. Provider errors fall back
// gracefully (photo counts as authentic, reason recorded) so posting never breaks.

const AI_GEN_THRESHOLD = Number(process.env.HIVE_AI_GEN_THRESHOLD || 0.7);
const HIVE_API_URL = process.env.HIVE_API_URL || 'https://api.thehive.ai/api/v2/task/sync';

// Timeout for outbound verification calls (default 5 seconds for demo resilience)
const VERIFICATION_TIMEOUT_MS = Number(process.env.VERIFICATION_TIMEOUT_MS || 5000);

// Pure logic: interpret a Hive sync-task response.
// Looks for the `ai_generated` class score in the first output's classes.
function evaluateHiveResponse(json, threshold = AI_GEN_THRESHOLD) {
  const classes = json?.status?.[0]?.response?.output?.[0]?.classes
    || json?.output?.[0]?.classes;
  if (!Array.isArray(classes)) return { verified: false, aiGenScore: null, reasons: ['unexpected_response'] };
  const aiGen = classes.find((c) => c.class === 'ai_generated');
  if (!aiGen || typeof aiGen.score !== 'number') {
    return { verified: false, aiGenScore: null, reasons: ['unexpected_response'] };
  }
  if (aiGen.score >= threshold) {
    return { verified: false, aiGenScore: aiGen.score, reasons: ['ai_generated_detected'] };
  }
  return { verified: true, aiGenScore: aiGen.score, reasons: ['hive_check_passed'] };
}

async function callHive(photoPath) {
  const fs = require('fs');
  const path = require('path');
  const form = new FormData();
  const buf = fs.readFileSync(photoPath);
  form.append('media', new Blob([buf]), path.basename(photoPath));

  // Use AbortController for timeout — demo must never hang on dead network
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT_MS);

  try {
    const res = await fetch(HIVE_API_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${process.env.HIVE_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`hive_http_${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new Error('hive_timeout');
    throw err;
  }
}

async function verifyAiAuthenticity(photoPath) {
  if (!photoPath) return { verified: false, reasons: ['no_photo'] };
  if (!process.env.HIVE_API_KEY) return { verified: true, reasons: ['dev_stub'] };
  try {
    const json = await callHive(photoPath);
    return evaluateHiveResponse(json);
  } catch (err) {
    // Fail open: provider outage must not block posting; signal simply passes with a note.
    return { verified: true, reasons: ['provider_error_fail_open', String(err.message || err)] };
  }
}

module.exports = {
  computeTier,
  haversineMeters,
  extractExif,
  evaluateExif,
  verifyExif,
  verifyUpi,
  verifyReceipt,
  verifyAiAuthenticity,
  verifyCommunityCorroboration,
  evaluateHiveResponse,
  MAX_DISTANCE_METERS,
  MAX_PHOTO_AGE_HOURS,
  AI_GEN_THRESHOLD,
  VERIFICATION_TIMEOUT_MS,
  COMMUNITY_WINDOW_DAYS,
  // Human-readable reason strings for display in app/modal
  REASON_DISPLAY: {
    // EXIF reasons
    no_gps: 'Photo has no GPS data',
    no_photo: 'No photo uploaded',
    too_far: 'Photo taken too far from restaurant location',
    restaurant_missing_coords: 'Restaurant location not available',
    timestamp_in_future: 'Photo timestamp is in the future',
    photo_too_old: 'Photo was taken too long ago',
    no_timestamp: 'Photo has no timestamp (GPS verified)',
    // UPI reasons
    no_utr: 'No UPI reference provided',
    invalid_format: 'Invalid UPI reference format',
    dev_format_check: 'UPI format verified (demo mode)',
    provider_not_implemented: 'UPI provider not configured',
    // Receipt reasons
    no_receipt: 'No receipt uploaded',
    ocr_not_implemented: 'Receipt OCR not available',
    // AI reasons
    ai_generated_detected: 'Photo appears to be AI-generated',
    hive_check_passed: 'Photo authenticity verified',
    unexpected_response: 'Authenticity check unavailable',
    dev_stub: 'Authenticity check (demo mode)',
    provider_error_fail_open: 'Authenticity provider unavailable',
    hive_timeout: 'Authenticity check timed out',
    // Community corroboration reasons
    corroboration_found: 'Another user verified this restaurant recently',
    no_corroboration: 'No recent verified reviews from other users',
    invalid_params: 'Community check skipped (missing data)',
  },
};
