// In-memory OTP rate limiting (T8)
// Limits per-phone and per-IP OTP requests + verify attempts.
// Note: In-memory only — resets on server restart. For production, use Redis.

// Config (env-overridable)
const OTP_REQUEST_WINDOW_MS = Number(process.env.OTP_REQUEST_WINDOW_MS || 60000);      // 1 minute
const OTP_REQUEST_MAX_PER_PHONE = Number(process.env.OTP_REQUEST_MAX_PER_PHONE || 3); // 3 requests per phone per window
const OTP_REQUEST_MAX_PER_IP = Number(process.env.OTP_REQUEST_MAX_PER_IP || 10);       // 10 requests per IP per window
const OTP_REQUEST_MAX_PER_IP_PRIVATE = Number(process.env.OTP_REQUEST_MAX_PER_IP_PRIVATE || 100); // Higher limit for private IPs
const OTP_VERIFY_MAX_ATTEMPTS = Number(process.env.OTP_VERIFY_MAX_ATTEMPTS || 5);      // 5 attempts per phone
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS || 300000);                     // 5 minutes

// Whether to exempt private IPs from per-IP rate limiting (default: yes for demo/NAT scenarios)
const RATE_LIMIT_EXEMPT_PRIVATE_IPS = process.env.RATE_LIMIT_EXEMPT_PRIVATE_IPS !== 'false';

/**
 * Check if an IP address is a private/LAN address (RFC 1918 + loopback + link-local).
 * Private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x, 169.254.x.x
 *
 * TRADEOFF: Exempting private IPs from per-IP rate limits allows multiple users behind
 * NAT (e.g., venue Wi-Fi during demo) to log in without hitting shared bucket limits.
 * The per-phone limit (3/min) remains the primary control against SMS pumping abuse.
 * Public IPs are still rate-limited to prevent distributed attacks.
 *
 * @param {string} ip - IP address to check
 * @returns {boolean} - true if private/LAN
 */
function isPrivateIp(ip) {
  if (!ip || typeof ip !== 'string') return false;

  // Handle IPv6-mapped IPv4 (e.g., ::ffff:192.168.1.1)
  const normalizedIp = ip.replace(/^::ffff:/, '');

  // IPv4 private ranges
  const parts = normalizedIp.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255)) {
    // 10.0.0.0/8
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  // IPv6 loopback
  if (normalizedIp === '::1') return true;

  return false;
}

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

  // Check per-phone rate limit (always applies — primary SMS pumping defense)
  const phoneEntry = phoneRequests.get(phone);
  if (phoneEntry) {
    if (now - phoneEntry.firstRequest < OTP_REQUEST_WINDOW_MS) {
      if (phoneEntry.count >= OTP_REQUEST_MAX_PER_PHONE) {
        const retryAfterMs = OTP_REQUEST_WINDOW_MS - (now - phoneEntry.firstRequest);
        return { allowed: false, reason: 'too_many_requests_phone', retryAfterMs };
      }
    }
  }

  // Check per-IP rate limit (uses higher threshold for private/LAN IPs)
  const ipEntry = ipRequests.get(ip);
  if (ipEntry) {
    if (now - ipEntry.firstRequest < OTP_REQUEST_WINDOW_MS) {
      // Private IPs get a higher limit to support NAT scenarios (e.g., demo venue Wi-Fi)
      const maxPerIp = (RATE_LIMIT_EXEMPT_PRIVATE_IPS && isPrivateIp(ip))
        ? OTP_REQUEST_MAX_PER_IP_PRIVATE
        : OTP_REQUEST_MAX_PER_IP;
      if (ipEntry.count >= maxPerIp) {
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
  isPrivateIp,
  _resetForTesting,
  // Export config for tests
  OTP_REQUEST_WINDOW_MS,
  OTP_REQUEST_MAX_PER_PHONE,
  OTP_REQUEST_MAX_PER_IP,
  OTP_REQUEST_MAX_PER_IP_PRIVATE,
  OTP_VERIFY_MAX_ATTEMPTS,
  OTP_EXPIRY_MS,
  RATE_LIMIT_EXEMPT_PRIVATE_IPS,
};
