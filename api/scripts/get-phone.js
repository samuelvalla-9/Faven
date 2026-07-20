// Dev helper: print a user's phone by username. Usage: node get-phone.js sammyum
const pool = require('../src/db/pool');
pool.query(`SELECT phone FROM users WHERE username=?`, [process.argv[2] || 'sammyum'])
  .then(([r]) => { console.log(r[0]?.phone || ''); process.exit(0); });
