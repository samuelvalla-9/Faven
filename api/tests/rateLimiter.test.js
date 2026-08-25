// Tests for OTP rate limiting (T8)
const {
  canRequestOtp,
  recordOtpRequest,
  canVerifyOtp,
  recordVerifyAttempt,
  clearVerifyAttempts,
  _resetForTesting,
  OTP_REQUEST_MAX_PER_PHONE,
  OTP_REQUEST_MAX_PER_IP,
  OTP_VERIFY_MAX_ATTEMPTS,
} = require('../src/middleware/rateLimiter');

beforeEach(() => {
  _resetForTesting();
});

describe('OTP request rate limiting', () => {
  test('allows requests under the limit', () => {
    const phone = '9800000001';
    const ip = '192.168.1.1';

    // First request should be allowed
    expect(canRequestOtp(phone, ip).allowed).toBe(true);
    recordOtpRequest(phone, ip);

    // Should still be allowed until we hit the limit
    for (let i = 1; i < OTP_REQUEST_MAX_PER_PHONE; i++) {
      expect(canRequestOtp(phone, ip).allowed).toBe(true);
      recordOtpRequest(phone, ip);
    }
  });

  test('blocks requests over per-phone limit', () => {
    const phone = '9800000001';
    const ip = '192.168.1.1';

    // Make max requests
    for (let i = 0; i < OTP_REQUEST_MAX_PER_PHONE; i++) {
      recordOtpRequest(phone, ip);
    }

    // Next request should be blocked
    const result = canRequestOtp(phone, ip);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_many_requests_phone');
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test('blocks requests over per-IP limit', () => {
    const ip = '192.168.1.1';

    // Make requests from different phones but same IP
    for (let i = 0; i < OTP_REQUEST_MAX_PER_IP; i++) {
      const phone = `980000000${i}`;
      recordOtpRequest(phone, ip);
    }

    // Next request from same IP should be blocked
    const result = canRequestOtp('9800000099', ip);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_many_requests_ip');
  });

  test('allows requests from different IPs', () => {
    const phone = '9800000001';

    // Max out requests from one IP
    for (let i = 0; i < OTP_REQUEST_MAX_PER_PHONE; i++) {
      recordOtpRequest(phone, `192.168.1.${i}`);
    }

    // Next request from a different phone should still work
    expect(canRequestOtp('9800000002', '192.168.1.100').allowed).toBe(true);
  });
});

describe('OTP verify rate limiting', () => {
  test('allows verify attempts under the limit', () => {
    const phone = '9800000001';

    for (let i = 0; i < OTP_VERIFY_MAX_ATTEMPTS - 1; i++) {
      expect(canVerifyOtp(phone).allowed).toBe(true);
      recordVerifyAttempt(phone);
    }

    // One more should still be allowed
    expect(canVerifyOtp(phone).allowed).toBe(true);
  });

  test('blocks verify attempts over the limit', () => {
    const phone = '9800000001';

    // Max out attempts
    for (let i = 0; i < OTP_VERIFY_MAX_ATTEMPTS; i++) {
      recordVerifyAttempt(phone);
    }

    // Next attempt should be blocked
    const result = canVerifyOtp(phone);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_many_verify_attempts');
    expect(result.attemptsRemaining).toBe(0);
  });

  test('clearVerifyAttempts resets the counter', () => {
    const phone = '9800000001';

    // Max out attempts
    for (let i = 0; i < OTP_VERIFY_MAX_ATTEMPTS; i++) {
      recordVerifyAttempt(phone);
    }

    // Should be blocked
    expect(canVerifyOtp(phone).allowed).toBe(false);

    // Clear and try again
    clearVerifyAttempts(phone);
    expect(canVerifyOtp(phone).allowed).toBe(true);
  });

  test('returns remaining attempts count', () => {
    const phone = '9800000001';

    const initial = canVerifyOtp(phone);
    expect(initial.attemptsRemaining).toBe(OTP_VERIFY_MAX_ATTEMPTS);

    recordVerifyAttempt(phone);
    recordVerifyAttempt(phone);

    const after = canVerifyOtp(phone);
    expect(after.attemptsRemaining).toBe(OTP_VERIFY_MAX_ATTEMPTS - 2);
  });
});
