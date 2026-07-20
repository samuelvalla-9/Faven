-- Faven MVP schema (Sprint 0)
CREATE DATABASE IF NOT EXISTS faven CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE faven;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL UNIQUE,
  name VARCHAR(80) DEFAULT NULL,
  username VARCHAR(40) DEFAULT NULL UNIQUE,
  city VARCHAR(60) DEFAULT 'Bangalore',
  credibility_score INT NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 0,
  streak_days INT NOT NULL DEFAULT 0,
  last_post_date DATE DEFAULT NULL,
  first_post_rewarded TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_otp_phone (phone)
);

CREATE TABLE IF NOT EXISTS restaurants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  google_place_id VARCHAR(120) DEFAULT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255) DEFAULT NULL,
  city VARCHAR(60) NOT NULL DEFAULT 'Bangalore',
  lat DECIMAL(10,7) DEFAULT NULL,
  lng DECIMAL(10,7) DEFAULT NULL,
  cuisine VARCHAR(80) DEFAULT NULL,
  price_level TINYINT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT,
  photo_url VARCHAR(500) DEFAULT NULL,
  -- verification signals (Sprint 2 fills these in)
  exif_verified TINYINT(1) NOT NULL DEFAULT 0,
  upi_verified TINYINT(1) NOT NULL DEFAULT 0,
  receipt_verified TINYINT(1) NOT NULL DEFAULT 0,
  ai_authentic TINYINT(1) NOT NULL DEFAULT 0,
  community_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_tier ENUM('reviewed','partial','full') NOT NULL DEFAULT 'reviewed',
  is_sponsored TINYINT(1) NOT NULL DEFAULT 0,
  visited_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
  INDEX idx_reviews_restaurant (restaurant_id),
  INDEX idx_reviews_user (user_id)
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('cashback_first_post','coins_streak','coins_post','voucher') NOT NULL,
  amount_inr DECIMAL(8,2) NOT NULL DEFAULT 0,
  coins INT NOT NULL DEFAULT 0,
  note VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Voucher milestones (Sprint 3 — data model only; redemption deferred).
-- A row is recorded when a user's lifetime post count crosses a threshold.
CREATE TABLE IF NOT EXISTS voucher_milestones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  threshold INT NOT NULL,               -- posts required (5 / 10 / 20)
  voucher_value_inr DECIMAL(8,2) NOT NULL DEFAULT 0,
  status ENUM('earned','redeemed','expired') NOT NULL DEFAULT 'earned',
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  redeemed_at DATETIME DEFAULT NULL,
  UNIQUE KEY uq_user_threshold (user_id, threshold),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
