const router = require('express').Router();
const pool = require('../db/pool');

// GET /restaurants?q=&city=  — keyword search (Google Places integration in Sprint 1)
router.get('/', async (req, res, next) => {
  try {
    const { q = '', city = '' } = req.query;
    const [rows] = await pool.query(
      `SELECT * FROM restaurants
       WHERE (? = '' OR name LIKE CONCAT('%', ?, '%') OR cuisine LIKE CONCAT('%', ?, '%'))
         AND (? = '' OR city = ?)
       ORDER BY name LIMIT 50`,
      [q, q, q, city, city]
    );
    res.json({ restaurants: rows });
  } catch (e) { next(e); }
});

// GET /restaurants/:id — detail + reviews
router.get('/:id', async (req, res, next) => {
  try {
    const [[restaurant]] = await pool.query(`SELECT * FROM restaurants WHERE id=?`, [req.params.id]);
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found' });
    const [reviews] = await pool.query(
      `SELECT r.*, u.username, u.name AS user_name, u.credibility_score
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.restaurant_id=? AND r.status <> 'removed' ORDER BY r.created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ restaurant, reviews });
  } catch (e) { next(e); }
});

module.exports = router;
