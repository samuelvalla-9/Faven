const router = require('express').Router();
const path = require('path');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// GET /admin — serve the moderation dashboard page (auth happens client-side via token)
router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'dashboard.html'));
});

// GET /admin/reviews?status=visible|flagged|removed|all — moderation queue
router.get('/reviews', auth, admin, async (req, res, next) => {
  try {
    const status = String(req.query.status || 'all');
    const valid = ['visible', 'flagged', 'removed'];
    const [rows] = await pool.query(
      `SELECT r.id, r.rating, r.body, r.photo_url, r.verification_tier, r.is_sponsored,
              r.status, r.moderation_note, r.created_at,
              u.id AS user_id, u.username, u.name AS user_name,
              rest.name AS restaurant_name, rest.city
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN restaurants rest ON rest.id = r.restaurant_id
       WHERE (? = 'all' OR r.status = ?)
       ORDER BY FIELD(r.status,'flagged','visible','removed'), r.created_at DESC
       LIMIT 200`,
      [valid.includes(status) ? status : 'all', status]
    );
    res.json({ reviews: rows });
  } catch (e) { next(e); }
});

// POST /admin/reviews/:id/status — body: { status: 'visible'|'flagged'|'removed', note? }
router.post('/reviews/:id/status', auth, admin, async (req, res, next) => {
  try {
    const { status, note } = req.body || {};
    if (!['visible', 'flagged', 'removed'].includes(status)) {
      return res.status(400).json({ error: 'status must be visible, flagged, or removed' });
    }
    const [r] = await pool.query(
      `UPDATE reviews SET status=?, moderation_note=? WHERE id=?`,
      [status, note || null, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Review not found' });
    res.json({ ok: true, id: Number(req.params.id), status });
  } catch (e) { next(e); }
});

// GET /admin/users — user list with post counts
router.get('/users', auth, admin, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.phone, u.name, u.username, u.city, u.credibility_score, u.coins,
              u.streak_days, u.is_admin, u.created_at,
              COUNT(r.id) AS total_posts,
              SUM(CASE WHEN r.status='removed' THEN 1 ELSE 0 END) AS removed_posts
       FROM users u
       LEFT JOIN reviews r ON r.user_id = u.id
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`
    );
    res.json({ users: rows });
  } catch (e) { next(e); }
});

module.exports = router;
