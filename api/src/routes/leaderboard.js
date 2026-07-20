const router = require('express').Router();
const pool = require('../db/pool');

// GET /leaderboard?city=Bangalore — monthly city leaderboard
// Resets on the 1st of each month. Includes rank movement vs last month.
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

    // Last month's standings (same ordering) → rank movement
    const [prevRows] = await pool.query(
      `SELECT u.id,
              COUNT(r.id) AS posts_last_month,
              SUM(r.verification_tier = 'full') AS fully_verified
       FROM users u
       LEFT JOIN reviews r ON r.user_id = u.id
         AND r.created_at >= DATE_FORMAT(NOW() - INTERVAL 1 MONTH, '%Y-%m-01')
         AND r.created_at <  DATE_FORMAT(NOW(), '%Y-%m-01')
       WHERE u.city = ?
       GROUP BY u.id
       ORDER BY fully_verified DESC, posts_last_month DESC, u.credibility_score DESC
       LIMIT 100`,
      [city]
    );
    const prevRank = new Map(prevRows.map((r, i) => [r.id, i + 1]));

    const leaderboard = rows.map((r, i) => {
      const rank = i + 1;
      const prev = prevRank.get(r.id) || null;
      return { ...r, rank, prev_rank: prev, movement: prev ? prev - rank : null };
    });

    // Monthly reset framing
    const now = new Date();
    const monthLabel = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysUntilReset = Math.ceil((nextReset - now) / 86400000);

    res.json({ city, month: monthLabel, resets_in_days: daysUntilReset, leaderboard });
  } catch (e) { next(e); }
});

module.exports = router;
