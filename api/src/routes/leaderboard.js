const router = require('express').Router();
const pool = require('../db/pool');

// GET /leaderboard?city=Bangalore — monthly city leaderboard
router.get('/', async (req, res, next) => {
  try {
    const city = req.query.city || 'Bangalore';
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.name, u.credibility_score, u.coins,
              COUNT(r.id) AS posts_this_month,
              SUM(r.verification_tier = 'full') AS fully_verified
       FROM users u
       LEFT JOIN reviews r ON r.user_id = u.id
         AND r.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')
       WHERE u.city = ?
       GROUP BY u.id
       ORDER BY fully_verified DESC, posts_this_month DESC, u.credibility_score DESC
       LIMIT 20`,
      [city]
    );
    res.json({ city, leaderboard: rows });
  } catch (e) { next(e); }
});

module.exports = router;
