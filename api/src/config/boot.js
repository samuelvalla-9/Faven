// Configuration validation for safe startup
// Ensures dangerous dev-only settings are not enabled in production

/**
 * Check if the dev OTP bypass is enabled.
 * The bypass exists when DEV_OTP_CODE is set in the environment.
 * @returns {boolean}
 */
function isDevOtpBypassEnabled() {
  return !!process.env.DEV_OTP_CODE;
}

/**
 * Check if we're running in production mode.
 * @returns {boolean}
 */
function isProductionMode() {
  return process.env.NODE_ENV === 'production';
}

/**
 * Validates boot-time configuration.
 * Returns { safe: boolean, fatal: string|null, warnings: string[] }
 *
 * @param {object} [env=process.env] - Environment variables to check
 * @returns {{ safe: boolean, fatal: string|null, warnings: string[] }}
 */
function validateBootConfig(env = process.env) {
  const warnings = [];
  let fatal = null;

  const isProd = env.NODE_ENV === 'production';
  const devOtpSet = !!env.DEV_OTP_CODE;

  // FATAL: Dev OTP bypass in production is a full account takeover risk
  if (isProd && devOtpSet) {
    fatal = 'FATAL: DEV_OTP_CODE is set in production mode. This allows any user to log into any account with a fixed OTP. Refusing to start.';
    return { safe: false, fatal, warnings };
  }

  // WARNING: Dev OTP bypass is active (acceptable in dev, but be loud about it)
  if (devOtpSet) {
    warnings.push(`⚠️  DEV_OTP_CODE is active. Any phone can be logged in with OTP "${env.DEV_OTP_CODE}". Do NOT use in production.`);
  }

  // WARNING: JWT_SECRET not set (using dev default)
  if (!env.JWT_SECRET) {
    warnings.push('⚠️  JWT_SECRET not set — using insecure default. Set in production.');
  }

  return { safe: true, fatal: null, warnings };
}

/**
 * Run boot validation and either exit or log warnings.
 * Call this at the start of server.js before any routes are registered.
 */
function enforceBootGuards() {
  const result = validateBootConfig();

  if (!result.safe && result.fatal) {
    console.error('');
    console.error('═'.repeat(60));
    console.error(result.fatal);
    console.error('═'.repeat(60));
    console.error('');
    process.exit(1);
  }

  for (const warn of result.warnings) {
    console.warn(warn);
  }
}

module.exports = { validateBootConfig, enforceBootGuards, isDevOtpBypassEnabled, isProductionMode };
