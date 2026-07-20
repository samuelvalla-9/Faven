const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

// GET /rewards — current user's reward history + totals
router.get('/', auth, async (req, res, next) => {
  try {
    const [entries] = await pool.query(
      `SELECT id, type, amount_inr, coins, note, created_at
       FROM reward_ledger WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 100`,
      [req.user.id]
    );
    const [[totals]] = await pool.query(
      `SELECT COALESCE(SUM(amount_inr),0) AS total_inr, COALESCE(SUM(coins),0) AS total_coins
       FROM reward_ledger WHERE user_id=?`,
      [req.user.id]
    );
    res.json({
      entries,
      totals: { inr: Number(totals.total_inr), coins: Number(totals.total_coins) },
    });
  } catch (e) { next(e); }
});

module.exports = router;
