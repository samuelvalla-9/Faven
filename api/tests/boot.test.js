// Tests for boot configuration validation (T6: Boot guard on dev OTP bypass)
const { validateBootConfig } = require('../src/config/boot');

describe('validateBootConfig (dev OTP boot guard)', () => {
  test('production + DEV_OTP_CODE is FATAL', () => {
    const result = validateBootConfig({ NODE_ENV: 'production', DEV_OTP_CODE: '123456' });
    expect(result.safe).toBe(false);
    expect(result.fatal).toMatch(/DEV_OTP_CODE.*production/i);
  });

  test('development + DEV_OTP_CODE is allowed with warning', () => {
    const result = validateBootConfig({ NODE_ENV: 'development', DEV_OTP_CODE: '123456' });
    expect(result.safe).toBe(true);
    expect(result.fatal).toBeNull();
    expect(result.warnings.some((w) => w.includes('DEV_OTP_CODE'))).toBe(true);
  });

  test('no NODE_ENV + DEV_OTP_CODE is allowed (defaults to dev)', () => {
    const result = validateBootConfig({ DEV_OTP_CODE: '123456' });
    expect(result.safe).toBe(true);
    expect(result.fatal).toBeNull();
    expect(result.warnings.some((w) => w.includes('DEV_OTP_CODE'))).toBe(true);
  });

  test('production without DEV_OTP_CODE is safe', () => {
    const result = validateBootConfig({ NODE_ENV: 'production', JWT_SECRET: 'real-secret' });
    expect(result.safe).toBe(true);
    expect(result.fatal).toBeNull();
    expect(result.warnings.length).toBe(0);
  });

  test('missing JWT_SECRET generates a warning', () => {
    const result = validateBootConfig({ NODE_ENV: 'development' });
    expect(result.safe).toBe(true);
    expect(result.warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
  });

  test('empty env is safe with warnings', () => {
    const result = validateBootConfig({});
    expect(result.safe).toBe(true);
    expect(result.warnings.some((w) => w.includes('JWT_SECRET'))).toBe(true);
  });
});
