#!/usr/bin/env node
/**
 * Demo venue seed script
 *
 * Seeds restaurants for a deterministic on-device demo:
 *  - 2-3 "venue" restaurants at/near the provided coordinates (real GPS will pass)
 *  - 1 "far" restaurant ~5km away for rejection demo (same photo fails)
 *
 * Usage:
 *   node api/scripts/seed-demo-venue.js <lat> <lng> [city]
 *
 * Example (Mumbai office demo):
 *   node api/scripts/seed-demo-venue.js 19.0760 72.8777 Mumbai
 *
 * The venue restaurants will be at the exact coords and within ~100m.
 * The "far" restaurant will be ~5km away to demonstrate a rejection.
 */

const pool = require('../src/db/pool');

function offsetLatLng(lat, lng, metersNorth, metersEast) {
  // Approximate: 1 degree lat ≈ 111,000m; 1 degree lng ≈ 111,000m * cos(lat)
  const latOffset = metersNorth / 111000;
  const lngOffset = metersEast / (111000 * Math.cos((lat * Math.PI) / 180));
  return [lat + latOffset, lng + lngOffset];
}

async function seedDemoVenue() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node seed-demo-venue.js <lat> <lng> [city]');
    console.error('Example: node seed-demo-venue.js 19.0760 72.8777 Mumbai');
    process.exit(1);
  }

  const lat = parseFloat(args[0]);
  const lng = parseFloat(args[1]);
  const city = args[2] || 'Demo City';

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    console.error('❌ Invalid lat/lng. Provide valid coordinates.');
    process.exit(1);
  }

  console.log(`📍 Seeding demo restaurants at: ${lat}, ${lng} (${city})`);

  // Venue restaurants (at or near the demo location - will pass verification)
  const venueRestaurants = [
    {
      name: 'Demo Venue - Main',
      address: 'Demo venue (exact location)',
      lat: lat,
      lng: lng,
      cuisine: 'Multi-Cuisine',
      price: 2,
      note: 'exact coords'
    },
    {
      name: 'Demo Venue - Nearby A',
      address: 'Demo venue (50m east)',
      lat: offsetLatLng(lat, lng, 0, 50)[0],
      lng: offsetLatLng(lat, lng, 0, 50)[1],
      cuisine: 'Indian',
      price: 2,
      note: '~50m offset'
    },
    {
      name: 'Demo Venue - Nearby B',
      address: 'Demo venue (80m north)',
      lat: offsetLatLng(lat, lng, 80, 0)[0],
      lng: offsetLatLng(lat, lng, 80, 0)[1],
      cuisine: 'Cafe',
      price: 1,
      note: '~80m offset'
    },
  ];

  // Far restaurant (~5km away - will FAIL verification with a clear rejection)
  const [farLat, farLng] = offsetLatLng(lat, lng, 5000, 0); // 5km north
  const farRestaurant = {
    name: 'Demo - Far Location (5km away)',
    address: 'Too far for demo photo verification',
    lat: farLat,
    lng: farLng,
    cuisine: 'Fast Food',
    price: 1,
    note: '~5km away - for rejection demo'
  };

  // Insert venue restaurants
  for (const r of venueRestaurants) {
    await pool.query(
      `INSERT INTO restaurants (name, address, city, lat, lng, cuisine, price_level)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE lat=VALUES(lat), lng=VALUES(lng)`,
      [r.name, r.address, city, r.lat, r.lng, r.cuisine, r.price]
    );
    console.log(`  ✅ ${r.name} (${r.note}) → ${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`);
  }

  // Insert far restaurant
  await pool.query(
    `INSERT INTO restaurants (name, address, city, lat, lng, cuisine, price_level)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE lat=VALUES(lat), lng=VALUES(lng)`,
    [farRestaurant.name, farRestaurant.address, city, farRestaurant.lat, farRestaurant.lng, farRestaurant.cuisine, farRestaurant.price]
  );
  console.log(`  ❌ ${farRestaurant.name} (${farRestaurant.note}) → ${farRestaurant.lat.toFixed(6)}, ${farRestaurant.lng.toFixed(6)}`);

  console.log(`
🎯 Demo setup complete!

Verification demo flow:
  1. Take a photo with device camera at the venue
  2. Post to "Demo Venue - Main" → should PASS (within ${process.env.EXIF_MAX_DISTANCE_M || 200}m threshold)
  3. Post same photo to "Demo - Far Location (5km away)" → should FAIL with reason "too_far"
     The rejection will show: "Photo taken too far from restaurant location"

Rejection reason mapping:
  - too_far: Photo GPS is more than ${process.env.EXIF_MAX_DISTANCE_M || 200}m from restaurant
  - no_gps: Photo has no GPS data (common if taken in browser)
  - photo_too_old: Photo was taken more than ${process.env.EXIF_MAX_AGE_HOURS || 72} hours ago
  - no_photo: No photo was uploaded
`);

  process.exit(0);
}

seedDemoVenue().catch((e) => {
  console.error('❌ Demo seed failed:', e.message);
  process.exit(1);
});
