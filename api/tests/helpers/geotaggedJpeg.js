// Test helper — generates geotagged JPEG fixtures using piexifjs.
// Lets us test real EXIF extraction (exifr) without needing a phone photo.

const fs = require('fs');
const os = require('os');
const path = require('path');
const piexif = require('piexifjs');

// Minimal valid 1x1 white JPEG (baseline, JFIF) as base64.
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
  'AhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQA' +
  'AAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3' +
  'ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWm' +
  'p6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMB' +
  'AAIRAxEAPwD3+iiigD//2Q==';

// Convert decimal degrees to EXIF DMS rational format
function toDms(deg) {
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = Math.round((minFloat - m) * 60 * 10000);
  return [[d, 1], [m, 1], [s, 10000]];
}

// Format a Date as EXIF "YYYY:MM:DD HH:MM:SS" (local time)
function toExifDate(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}:${p(date.getMonth() + 1)}:${p(date.getDate())} ` +
    `${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/**
 * Create a temp JPEG with the given GPS coords and capture time embedded in EXIF.
 * @param {{ lat?: number, lng?: number, takenAt?: Date }} opts — omit lat/lng for a GPS-less photo
 * @returns {string} absolute path to the generated file (caller should clean up)
 */
function createGeotaggedJpeg({ lat, lng, takenAt } = {}) {
  const exifObj = { '0th': {}, Exif: {}, GPS: {} };

  if (takenAt) {
    exifObj.Exif[piexif.ExifIFD.DateTimeOriginal] = toExifDate(takenAt);
  }
  if (lat != null && lng != null) {
    exifObj.GPS[piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
    exifObj.GPS[piexif.GPSIFD.GPSLatitude] = toDms(lat);
    exifObj.GPS[piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
    exifObj.GPS[piexif.GPSIFD.GPSLongitude] = toDms(lng);
  }

  const jpegBinary = Buffer.from(TINY_JPEG_B64, 'base64').toString('binary');
  const withExif = piexif.insert(piexif.dump(exifObj), jpegBinary);

  const file = path.join(os.tmpdir(), `faven-exif-test-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`);
  fs.writeFileSync(file, Buffer.from(withExif, 'binary'));
  return file;
}

module.exports = { createGeotaggedJpeg };
