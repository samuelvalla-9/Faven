// In-memory OTP rate limiting (T8)
// Limits per-phone and per-IP OTP requests + verify attempts.
// Note: In-memory only — resets on server restart. For production, use Redis.

// Config (env-overridable)
const OTP_REQUEST_WINDOW_MS = Number(process.env.OTP_REQUEST_WINDOW_MS || 60000);      // 1 minute
const OTP_REQUEST_MAX_PER_PHONE = Number(process.env.OTP_REQUEST_MAX_PER_PHONE || 3); // 3 requests per phone per window
const OTP_REQUEST_MAX_PER_IP = Number(process.env.OTP_REQUEST_MAX_PER_IP || 10);       // 10 requests per IP per window
const OTP_VERIFY_MAX_ATTEMPTS = Number(process.env.OTP_VERIFY_MAX_ATTEMPTS || 5);      // 5 attempts per phone
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS || 300000);                     // 5 minutes

// In-memory stores
// Structure: { [key]: { count: number, firstRequest: timestamp } }
const phoneRequests = new Map();
const ipRequests = new Map();
const verifyAttempts = new Map(); // { [phone]: { count: number, firstAttempt: timestamp } }

// Cleanup old entries periodically (every minute)
// Use unref() so the timer doesn't keep the process alive (allows clean Jest exit)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of phoneRequests) {
    if (now - val.firstRequest > OTP_REQUEST_WINDOW_MS) phoneRequests.delete(key);
  }
  for (const [key, val] of ipRequests) {
    if (now - val.firstRequest > OTP_REQUEST_WINDOW_MS) ipRequests.delete(key);
  }
  for (const [key, val] of verifyAttempts) {
    if (now - val.firstAttempt > OTP_EXPIRY_MS) verifyAttempts.delete(key);
  }
}, 60000);
cleanupInterval.unref();

/**
 * Check if an OTP request is allowed for the given phone and IP.
 * @param {string} phone - Normalized phone number
 * @param {string} ip - Request IP address
 * @returns {{ allowed: boolean, reason?: string, retryAfterMs?: number }}
 */
function canRequestOtp(phone, ip) {
  const now = Date.now();

  // Check per-phone rate limit
  const phoneEntry = phoneRequests.get(phone);
  if (phoneEntry) {
    if (now - phoneEntry.firstRequest < OTP_REQUEST_WINDOW_MS) {
      if (phoneEntry.count >= OTP_REQUEST_MAX_PER_PHONE) {
        const retryAfterMs = OTP_REQUEST_WINDOW_MS - (now - phoneEntry.firstRequest);
        return { allowed: false, reason: 'too_many_requests_phone', retryAfterMs };
      }
    }
  }

  // Check per-IP rate limit
  const ipEntry = ipRequests.get(ip);
  if (ipEntry) {
    if (now - ipEntry.firstRequest < OTP_REQUEST_WINDOW_MS) {
      if (ipEntry.count >= OTP_REQUEST_MAX_PER_IP) {
        const retryAfterMs = OTP_REQUEST_WINDOW_MS - (now - ipEntry.firstRequest);
        return { allowed: false, reason: 'too_many_requests_ip', retryAfterMs };
      }
    }
  }

  return { allowed: true };
}

/**
 * Record an OTP request for rate limiting tracking.
 * @param {string} phone - Normalized phone number
 * @param {string} ip - Request IP address
 */
function recordOtpRequest(phone, ip) {
  const now = Date.now();

  // Update phone counter
  const phoneEntry = phoneRequests.get(phone);
  if (phoneEntry && now - phoneEntry.firstRequest < OTP_REQUEST_WINDOW_MS) {
    phoneEntry.count++;
  } else {
    phoneRequests.set(phone, { count: 1, firstRequest: now });
  }

  // Update IP counter
  const ipEntry = ipRequests.get(ip);
  if (ipEntry && now - ipEntry.firstRequest < OTP_REQUEST_WINDOW_MS) {
    ipEntry.count++;
  } else {
    ipRequests.set(ip, { count: 1, firstRequest: now });
  }
}

/**
 * Check if a verify attempt is allowed for the given phone.
 * @param {string} phone - Normalized phone number
 * @returns {{ allowed: boolean, reason?: string, attemptsRemaining?: number }}
 */
function canVerifyOtp(phone) {
  const now = Date.now();
  const entry = verifyAttempts.get(phone);

  if (entry) {
    if (now - entry.firstAttempt < OTP_EXPIRY_MS) {
      if (entry.count >= OTP_VERIFY_MAX_ATTEMPTS) {
        return { allowed: false, reason: 'too_many_verify_attempts', attemptsRemaining: 0 };
      }
      return { allowed: true, attemptsRemaining: OTP_VERIFY_MAX_ATTEMPTS - entry.count };
    }
  }

  return { allowed: true, attemptsRemaining: OTP_VERIFY_MAX_ATTEMPTS };
}

/**
 * Record a failed verify attempt for rate limiting.
 * @param {string} phone - Normalized phone number
 */
function recordVerifyAttempt(phone) {
  const now = Date.now();
  const entry = verifyAttempts.get(phone);

  if (entry && now - entry.firstAttempt < OTP_EXPIRY_MS) {
    entry.count++;
  } else {
    verifyAttempts.set(phone, { count: 1, firstAttempt: now });
  }
}

/**
 * Clear verify attempts for a phone (call on successful verification).
 * @param {string} phone - Normalized phone number
 */
function clearVerifyAttempts(phone) {
  verifyAttempts.delete(phone);
}

// For testing: reset all in-memory stores
function _resetForTesting() {
  phoneRequests.clear();
  ipRequests.clear();
  verifyAttempts.clear();
}

module.exports = {
  canRequestOtp,
  recordOtpRequest,
  canVerifyOtp,
  recordVerifyAttempt,
  clearVerifyAttempts,
  _resetForTesting,
  // Export config for tests
  OTP_REQUEST_WINDOW_MS,
  OTP_REQUEST_MAX_PER_PHONE,
  OTP_REQUEST_MAX_PER_IP,
  OTP_VERIFY_MAX_ATTEMPTS,
  OTP_EXPIRY_MS,
};
