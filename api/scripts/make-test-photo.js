// Dev utility: generate a geotagged JPEG for manual EXIF verification testing.
// Usage: node scripts/make-test-photo.js [lat] [lng] [out.jpg]
// Defaults to 12.9716,77.5946 (seed restaurant area) and ./test-photo.jpg, taken "now".

const path = require('path');
const fs = require('fs');
const { createGeotaggedJpeg } = require('../tests/helpers/geotaggedJpeg');

const lat = Number(process.argv[2] ?? 12.9716);
const lng = Number(process.argv[3] ?? 77.5946);
const out = path.resolve(process.argv[4] ?? 'test-photo.jpg');

const tmp = createGeotaggedJpeg({ lat, lng, takenAt: new Date() });
fs.copyFileSync(tmp, out);
fs.unlinkSync(tmp);
console.log(`Geotagged JPEG written: ${out}`);
console.log(`  GPS: ${lat}, ${lng} · DateTimeOriginal: now`);
console.log(`Try: curl.exe -s -X POST http://localhost:4000/reviews -H "Authorization: Bearer <token>" -F "restaurant_id=1" -F "rating=5" -F "photo=@${out}"`);
