// Verification service — Sprint 2 replaces stubs with real EXIF / UPI / OCR / AI checks.
// Tier rules (per product doc): 4-5 signals = full, 2-3 = partial, else reviewed.

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

// Stub: EXIF GPS/timestamp check against restaurant coords (real impl in Sprint 2)
async function verifyExif(_photoPath, _restaurant) {
  return false;
}

// Stub: UPI UTR verification (real impl behind payment provider later)
async function verifyUpi(_utr) {
  return false;
}

module.exports = { computeTier, verifyExif, verifyUpi };
