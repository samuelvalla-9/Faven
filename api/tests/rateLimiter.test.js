// Tests for OTP rate limiting (T8)
const {
  canRequestOtp,
  recordOtpRequest,
  canVerifyOtp,
  recordVerifyAttempt,
  clearVerifyAttempts,
  isPrivateIp,
  _resetForTesting,
  OTP_REQUEST_MAX_PER_PHONE,
  OTP_REQUEST_MAX_PER_IP,
  OTP_REQUEST_MAX_PER_IP_PRIVATE,
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

  test('blocks requests over per-IP limit (public IP)', () => {
    const ip = '8.8.8.8'; // Use public IP to test standard limit

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

describe('isPrivateIp', () => {
  test('detects 10.x.x.x as private', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('10.255.255.255')).toBe(true);
  });

  test('detects 172.16-31.x.x as private', () => {
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('172.15.0.1')).toBe(false);
    expect(isPrivateIp('172.32.0.1')).toBe(false);
  });

  test('detects 192.168.x.x as private', () => {
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('192.168.255.255')).toBe(true);
  });

  test('detects loopback as private', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('127.255.255.255')).toBe(true);
    expect(isPrivateIp('::1')).toBe(true);
  });

  test('detects link-local as private', () => {
    expect(isPrivateIp('169.254.0.1')).toBe(true);
    expect(isPrivateIp('169.254.255.255')).toBe(true);
  });

  test('handles IPv6-mapped IPv4', () => {
    expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
    expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
  });

  test('rejects public IPs', () => {
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('203.0.113.1')).toBe(false);
    expect(isPrivateIp('1.2.3.4')).toBe(false);
  });

  test('handles invalid input', () => {
    expect(isPrivateIp(null)).toBe(false);
    expect(isPrivateIp(undefined)).toBe(false);
    expect(isPrivateIp('')).toBe(false);
    expect(isPrivateIp('not-an-ip')).toBe(false);
  });
});

describe('NAT-tolerant rate limiting', () => {
  test('private IPs get higher limit', () => {
    const privateIp = '192.168.1.1';

    // Make requests up to the standard limit
    for (let i = 0; i < OTP_REQUEST_MAX_PER_IP; i++) {
      const phone = `980000000${i}`;
      recordOtpRequest(phone, privateIp);
    }

    // Should still be allowed (private IP has higher limit)
    expect(canRequestOtp('9800000099', privateIp).allowed).toBe(true);
  });

  test('public IPs are blocked at standard limit', () => {
    const publicIp = '8.8.8.8';

    // Make requests up to the standard limit
    for (let i = 0; i < OTP_REQUEST_MAX_PER_IP; i++) {
      const phone = `980000000${i}`;
      recordOtpRequest(phone, publicIp);
    }

    // Should be blocked
    const result = canRequestOtp('9800000099', publicIp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_many_requests_ip');
  });

  test('per-phone limit still applies regardless of IP type', () => {
    const phone = '9800000001';
    const privateIp = '192.168.1.1';

    // Max out per-phone requests
    for (let i = 0; i < OTP_REQUEST_MAX_PER_PHONE; i++) {
      recordOtpRequest(phone, privateIp);
    }

    // Should be blocked by per-phone limit even with private IP
    const result = canRequestOtp(phone, privateIp);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('too_many_requests_phone');
  });

  test('multiple phones can login from same private IP', () => {
    const privateIp = '192.168.1.1';
    const phones = [];

    // Simulate many different phones logging in from same NAT
    for (let i = 0; i < 50; i++) {
      const phone = `98000000${String(i).padStart(2, '0')}`;
      phones.push(phone);

      // Each phone makes one request
      expect(canRequestOtp(phone, privateIp).allowed).toBe(true);
      recordOtpRequest(phone, privateIp);
    }

    // All 50 should have been allowed (under private IP limit of 100)
    expect(phones.length).toBe(50);
  });
});
