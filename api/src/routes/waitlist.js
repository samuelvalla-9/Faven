// Waitlist endpoint for landing page signups
const router = require('express').Router();
const pool = require('../db/pool');

// POST /waitlist { email }
router.post('/', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    // Basic email validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Dedupe: insert only if not already on the list
    const [existing] = await pool.query(
      `SELECT id FROM waitlist WHERE email = ?`,
      [email]
    );

    if (existing.length > 0) {
      // Already on the list — return success (idempotent)
      return res.json({ ok: true, message: 'Already on the waitlist', new: false });
    }

    await pool.query(
      `INSERT INTO waitlist (email, created_at) VALUES (?, NOW())`,
      [email]
    );

    res.json({ ok: true, message: 'Added to waitlist', new: true });
  } catch (e) {
    next(e);
  }
});

// GET /waitlist/count — optional: get total signups (for admin)
router.get('/count', async (_req, res, next) => {
  try {
    const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM waitlist');
    res.json({ count });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
