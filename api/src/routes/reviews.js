const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db/pool');
const auth = require('../middleware/auth');
const { computeTier, verifyExif, verifyUpi, verifyReceipt, verifyAiAuthenticity } = require('../services/verification');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /reviews/feed — latest reviews across restaurants
router.get('/feed', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, u.username, u.name AS user_name, u.credibility_score,
              rest.name AS restaurant_name, rest.city
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       JOIN restaurants rest ON rest.id = r.restaurant_id
       ORDER BY r.created_at DESC LIMIT 50`
    );
    res.json({ reviews: rows });
  } catch (e) { next(e); }
});

// POST /reviews (multipart)
// fields: restaurant_id, rating, body, is_sponsored, utr (optional UPI ref)
// files: photo (dish photo, EXIF checked), receipt (optional bill photo)
router.post('/', auth, upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'receipt', maxCount: 1 }]), async (req, res, next) => {
  try {
    const { restaurant_id, rating, body, is_sponsored, utr } = req.body;
    if (!restaurant_id || !rating) return res.status(400).json({ error: 'restaurant_id and rating required' });
    const sponsored = is_sponsored === true || is_sponsored === 1 || is_sponsored === '1' || is_sponsored === 'true';

    const [[restaurant]] = await pool.query(`SELECT * FROM restaurants WHERE id=?`, [restaurant_id]);
    if (!restaurant) return res.status(404).json({ error: 'restaurant not found' });

    const photoFile = req.files?.photo?.[0] || null;
    const receiptFile = req.files?.receipt?.[0] || null;
    const photoUrl = photoFile ? `/uploads/${photoFile.filename}` : null;

    // Live verification signals (community corroboration is post-MVP → always 0)
    const [exifRes, upiRes, receiptRes, aiRes] = await Promise.all([
      verifyExif(photoFile?.path, restaurant),
      verifyUpi(utr),
      verifyReceipt(receiptFile?.path, restaurant),
      verifyAiAuthenticity(photoFile?.path),
    ]);
    const signals = {
      exif_verified: exifRes.verified ? 1 : 0,
      upi_verified: upiRes.verified ? 1 : 0,
      receipt_verified: receiptRes.verified ? 1 : 0,
      ai_authentic: aiRes.verified ? 1 : 0,
      community_verified: 0,
    };
    const tier = computeTier(signals);
    const verification = {
      tier,
      signals,
      details: { exif: exifRes, upi: upiRes, receipt: receiptRes, ai: aiRes },
    };

    const [r] = await pool.query(
      `INSERT INTO reviews (user_id, restaurant_id, rating, body, photo_url,
        exif_verified, upi_verified, receipt_verified, ai_authentic, community_verified,
        verification_tier, is_sponsored, visited_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, NOW())`,
      [req.user.id, restaurant_id, rating, body || '', photoUrl,
       signals.exif_verified, signals.upi_verified, signals.receipt_verified,
       signals.ai_authentic, signals.community_verified, tier, sponsored ? 1 : 0]
    );

    // First-post ₹25 cashback (mock ledger) — product rule: only for a Fully
    // Verified post (4–5 signals → tier 'full'). Live as of Sprint 2.
    const [[user]] = await pool.query(`SELECT * FROM users WHERE id=?`, [req.user.id]);
    const rewards = [];
    if (!user.first_post_rewarded && tier === 'full') {
      await pool.query(
        `INSERT INTO reward_ledger (user_id, type, amount_inr, note) VALUES (?, 'cashback_first_post', 25, 'First verified post cashback (dev mock)')`,
        [req.user.id]
      );
      await pool.query(`UPDATE users SET first_post_rewarded=1 WHERE id=?`, [req.user.id]);
      rewards.push({ type: 'cashback_first_post', amount_inr: 25 });
    }
    await pool.query(
      `INSERT INTO reward_ledger (user_id, type, coins, note) VALUES (?, 'coins_post', 10, 'Post reward (FAV Coins)')`,
      [req.user.id]
    );
    await pool.query(`UPDATE users SET coins = coins + 10, last_post_date = CURDATE() WHERE id=?`, [req.user.id]);
    rewards.push({ type: 'coins_post', coins: 10 });

    const [[review]] = await pool.query(`SELECT * FROM reviews WHERE id=?`, [r.insertId]);
    res.status(201).json({ review, rewards, verification });
  } catch (e) { next(e); }
});

module.exports = router;
