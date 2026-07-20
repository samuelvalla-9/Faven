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

// AI photo authenticity — Hive Moderation API in Sprint 4; permissive stub in dev.
async function verifyAiAuthenticity(photoPath) {
  if (!photoPath) return { verified: false, reasons: ['no_photo'] };
  if (process.env.HIVE_API_KEY) {
    // TODO Sprint 4: call Hive Moderation API
    return { verified: false, reasons: ['provider_not_implemented'] };
  }
  return { verified: true, reasons: ['dev_stub'] };
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
  MAX_DISTANCE_METERS,
  MAX_PHOTO_AGE_HOURS,
};
