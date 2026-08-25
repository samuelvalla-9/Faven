// Stats endpoint for dataset visibility (Sprint 5 demo)
// Returns aggregate statistics about the verified review database

const router = require('express').Router();
const pool = require('../db/pool');

// GET /stats — public read-only aggregate endpoint
// Returns: total reviews by tier, verified vs unverified split, restaurant count,
// reviews per city, and lightweight lat/lng/tier data for visualization.
router.get('/', async (_req, res, next) => {
  try {
    // Total reviews by tier
    const [[totalReviews]] = await pool.query(`
      SELECT COUNT(*) AS total FROM reviews WHERE status <> 'removed'
    `);

    const [tierCounts] = await pool.query(`
      SELECT verification_tier AS tier, COUNT(*) AS count
      FROM reviews WHERE status <> 'removed'
      GROUP BY verification_tier
    `);
    const byTier = tierCounts.reduce((acc, row) => {
      acc[row.tier] = row.count;
      return acc;
    }, { full: 0, partial: 0, reviewed: 0 });

    // Verified (full + partial) vs unverified (reviewed)
    const verified = (byTier.full || 0) + (byTier.partial || 0);
    const unverified = byTier.reviewed || 0;

    // Restaurant count
    const [[restaurantCount]] = await pool.query(`SELECT COUNT(*) AS count FROM restaurants`);

    // Reviews per city
    const [cityCounts] = await pool.query(`
      SELECT rest.city, COUNT(*) AS count
      FROM reviews r
      JOIN restaurants rest ON rest.id = r.restaurant_id
      WHERE r.status <> 'removed'
      GROUP BY rest.city
      ORDER BY count DESC
      LIMIT 10
    `);

    // Lightweight location data for visualization (lat, lng, tier)
    // Limit to recent 500 for performance; uses restaurant coords as proxy
    const [locations] = await pool.query(`
      SELECT rest.lat, rest.lng, r.verification_tier AS tier
      FROM reviews r
      JOIN restaurants rest ON rest.id = r.restaurant_id
      WHERE r.status <> 'removed' AND rest.lat IS NOT NULL AND rest.lng IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT 500
    `);

    // Signal breakdown (how often each signal passes)
    const [[signalStats]] = await pool.query(`
      SELECT
        SUM(exif_verified) AS exif_count,
        SUM(upi_verified) AS upi_count,
        SUM(receipt_verified) AS receipt_count,
        SUM(ai_authentic) AS ai_count,
        SUM(community_verified) AS community_count,
        COUNT(*) AS total
      FROM reviews WHERE status <> 'removed'
    `);

    res.json({
      summary: {
        totalReviews: totalReviews.total,
        verified,
        unverified,
        verificationRate: totalReviews.total > 0
          ? Math.round((verified / totalReviews.total) * 100)
          : 0,
        restaurantCount: restaurantCount.count,
      },
      byTier,
      byCity: cityCounts,
      signalBreakdown: {
        exif: signalStats.exif_count || 0,
        upi: signalStats.upi_count || 0,
        receipt: signalStats.receipt_count || 0,
        ai: signalStats.ai_count || 0,
        community: signalStats.community_count || 0,
      },
      locations: locations.map((l) => ({
        lat: Number(l.lat),
        lng: Number(l.lng),
        tier: l.tier,
      })),
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
