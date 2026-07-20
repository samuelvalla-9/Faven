const router = require('express').Router();
const pool = require('../db/pool');

// GET /search?q=&limit= — keyword search across restaurants and review bodies
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    if (!q) return res.status(400).json({ error: 'q query parameter required' });

    const [restaurants] = await pool.query(
      `SELECT id, name, cuisine, city, address, lat, lng
       FROM restaurants
       WHERE name LIKE CONCAT('%', ?, '%')
          OR cuisine LIKE CONCAT('%', ?, '%')
          OR address LIKE CONCAT('%', ?, '%')
       ORDER BY name LIMIT ?`,
      [q, q, q, limit]
    );

    const [reviews] = await pool.query(
      `SELECT r.id, r.rating, r.body, r.photo_url, r.verification_tier, r.is_sponsored, r.created_at,
              u.username, u.name AS user_name, u.credibility_score,
              rest.id AS restaurant_id, rest.name AS restaurant_name, rest.city
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN restaurants rest ON rest.id = r.restaurant_id
       WHERE r.body LIKE CONCAT('%', ?, '%')
       ORDER BY r.created_at DESC LIMIT ?`,
      [q, limit]
    );

    res.json({ q, restaurants, reviews });
  } catch (e) { next(e); }
});

module.exports = router;
