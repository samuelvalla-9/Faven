// Seed dummy data for local development
const pool = require('./pool');

const restaurants = [
  ['CTR (Central Tiffin Room)', '7th Cross, Malleshwaram', 'Bangalore', 13.0027, 77.5701, 'South Indian', 1],
  ['Vidyarthi Bhavan', 'Gandhi Bazaar, Basavanagudi', 'Bangalore', 12.9452, 77.5687, 'South Indian', 1],
  ['Truffles', 'St. Marks Road', 'Bangalore', 12.9718, 77.6011, 'Burgers & Continental', 2],
  ['Meghana Foods', 'Residency Road', 'Bangalore', 12.9667, 77.6055, 'Biryani', 2],
  ['Toit Brewpub', '100 Feet Road, Indiranagar', 'Bangalore', 12.9790, 77.6403, 'Brewpub', 3],
  ['Rameshwaram Cafe', 'Brookefield', 'Bangalore', 12.9663, 77.7181, 'South Indian', 1],
];

const users = [
  ['9800000001', 'Asha Rao', 'asha_eats', 'Bangalore', 82],
  ['9800000002', 'Rohan Iyer', 'rohan.bites', 'Bangalore', 55],
  ['9800000003', 'Meera K', 'meera_food', 'Bangalore', 30],
];

const bodies = [
  'Benne masala dosa was unreal. Crisp edges, molten butter. Worth the queue.',
  'Classic spot — filter coffee alone justifies the trip.',
  'Biryani portion is huge, spice level honest. Verified with UPI.',
  'Great vibe, decent food. Photos are exactly what you get.',
];

(async () => {
  for (const [name, address, city, lat, lng, cuisine, price] of restaurants) {
    await pool.query(
      `INSERT IGNORE INTO restaurants (name, address, city, lat, lng, cuisine, price_level)
       VALUES (?,?,?,?,?,?,?)`,
      [name, address, city, lat, lng, cuisine, price]
    );
  }
  for (const [phone, name, username, city, cred] of users) {
    await pool.query(
      `INSERT IGNORE INTO users (phone, name, username, city, credibility_score)
       VALUES (?,?,?,?,?)`,
      [phone, name, username, city, cred]
    );
  }
  const [[{ c: reviewCount }]] = await pool.query('SELECT COUNT(*) c FROM reviews');
  if (reviewCount === 0) {
    for (let i = 0; i < 8; i++) {
      const userId = (i % users.length) + 1;
      const restId = (i % restaurants.length) + 1;
      const tier = i % 3 === 0 ? 'full' : i % 3 === 1 ? 'partial' : 'reviewed';
      await pool.query(
        `INSERT INTO reviews (user_id, restaurant_id, rating, body, exif_verified, upi_verified, ai_authentic, verification_tier, visited_at)
         VALUES (?,?,?,?,?,?,?,?, NOW() - INTERVAL ? DAY)`,
        [userId, restId, 3 + (i % 3), bodies[i % bodies.length], tier !== 'reviewed' ? 1 : 0, tier === 'full' ? 1 : 0, 1, tier, i]
      );
    }
  }
  console.log('✅ Seed complete.');
  process.exit(0);
})().catch((e) => {
  console.error('❌ seed failed:', e.message);
  process.exit(1);
});
