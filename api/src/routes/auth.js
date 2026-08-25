const router = require('express').Router();
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const {
  canRequestOtp,
  recordOtpRequest,
  canVerifyOtp,
  recordVerifyAttempt,
  clearVerifyAttempts,
} = require('../middleware/rateLimiter');

// Helper to get client IP (works behind proxies if trust proxy is set)
function getClientIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
}

// POST /auth/otp/request { phone }
// Dev mode: OTP is DEV_OTP_CODE (default 123456). Swap for SMS provider later.
router.post('/otp/request', async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    if (phone.length < 10) return res.status(400).json({ error: 'Valid 10-digit phone required' });

    const ip = getClientIp(req);

    // Rate limiting check
    const rateCheck = canRequestOtp(phone, ip);
    if (!rateCheck.allowed) {
      const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 60000) / 1000);
      return res.status(429).json({
        error: 'Too many OTP requests. Please wait before trying again.',
        reason: rateCheck.reason,
        retryAfterSec,
      });
    }

    // Record the request for rate limiting
    recordOtpRequest(phone, ip);

    const code = process.env.DEV_OTP_CODE || '123456';
    await pool.query(
      `INSERT INTO otp_codes (phone, code, expires_at) VALUES (?,?, NOW() + INTERVAL 5 MINUTE)`,
      [phone, code]
    );
    res.json({ ok: true, message: 'OTP sent (dev mode: use 123456)' });
  } catch (e) { next(e); }
});

// POST /auth/otp/verify { phone, code } -> { token, user }
router.post('/otp/verify', async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const code = String(req.body.code || '');

    // Rate limiting check for verify attempts
    const rateCheck = canVerifyOtp(phone);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: 'Too many verification attempts. Please request a new OTP.',
        reason: rateCheck.reason,
      });
    }

    const [rows] = await pool.query(
      `SELECT id FROM otp_codes WHERE phone=? AND code=? AND used=0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [phone, code]
    );
    if (!rows.length) {
      // Record failed attempt
      recordVerifyAttempt(phone);
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }
    await pool.query(`UPDATE otp_codes SET used=1 WHERE id=?`, [rows[0].id]);

    // Clear verify attempts on success
    clearVerifyAttempts(phone);

    let [[user]] = await pool.query(`SELECT * FROM users WHERE phone=?`, [phone]);
    if (!user) {
      const [r] = await pool.query(`INSERT INTO users (phone) VALUES (?)`, [phone]);
      [[user]] = await pool.query(`SELECT * FROM users WHERE id=?`, [r.insertId]);
    }
    const token = jwt.sign({ id: user.id, phone: user.phone }, process.env.JWT_SECRET || 'dev-secret', {
      expiresIn: '30d',
    });
    res.json({ token, user });
  } catch (e) { next(e); }
});

// GET /auth/me
router.get('/me', require('../middleware/auth'), async (req, res, next) => {
  try {
    const [[user]] = await pool.query(`SELECT * FROM users WHERE id=?`, [req.user.id]);
    res.json({ user });
  } catch (e) { next(e); }
});

// PATCH /auth/me { name, username, city }
router.patch('/me', require('../middleware/auth'), async (req, res, next) => {
  try {
    const { name, username, city } = req.body;
    await pool.query(
      `UPDATE users SET name=COALESCE(?,name), username=COALESCE(?,username), city=COALESCE(?,city) WHERE id=?`,
      [name || null, username || null, city || null, req.user.id]
    );
    const [[user]] = await pool.query(`SELECT * FROM users WHERE id=?`, [req.user.id]);
    res.json({ user });
  } catch (e) { next(e); }
});

module.exports = router;
