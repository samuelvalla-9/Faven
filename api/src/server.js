const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const reviewRoutes = require('./routes/reviews');
const leaderboardRoutes = require('./routes/leaderboard');
const rewardRoutes = require('./routes/rewards');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const statsRoutes = require('./routes/stats');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'faven-api', ts: Date.now() }));

app.use('/auth', authRoutes);
app.use('/restaurants', restaurantRoutes);
app.use('/reviews', reviewRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/rewards', rewardRoutes);
app.use('/search', searchRoutes);
app.use('/admin', adminRoutes);
app.use('/stats', statsRoutes);

// central error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🔥 Faven API on http://localhost:${PORT}`));
