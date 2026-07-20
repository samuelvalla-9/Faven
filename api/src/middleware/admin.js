// Admin-only middleware — runs after auth; checks users.is_admin in DB
const pool = require('../db/pool');

module.exports = async function admin(req, res, next) {
  try {
    const [[row]] = await pool.query(`SELECT is_admin FROM users WHERE id=?`, [req.user.id]);
    if (!row || !row.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
  } catch (e) { next(e); }
};
