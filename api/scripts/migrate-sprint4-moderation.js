// One-off dev migration: Sprint 4 moderation columns. Safe to re-run.
const pool = require('../src/db/pool');

(async () => {
  const run = async (label, sql) => {
    try { await pool.query(sql); console.log(label, 'ok'); }
    catch (e) { console.log(label, e.code || e.message); }
  };
  await run('users.is_admin', `ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0`);
  await run('reviews.status', `ALTER TABLE reviews ADD COLUMN status ENUM('visible','flagged','removed') NOT NULL DEFAULT 'visible', ADD COLUMN moderation_note VARCHAR(255) DEFAULT NULL`);
  await run('mark admin', `UPDATE users SET is_admin=1 WHERE username='sammyum'`);
  const [admins] = await pool.query(`SELECT id, username, is_admin FROM users WHERE is_admin=1`);
  console.log('admins:', admins);
  process.exit(0);
})();
