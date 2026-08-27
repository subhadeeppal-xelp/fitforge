-- FitForge MySQL schema
-- Run once against your database (see README for how to apply this on Railway).

CREATE TABLE IF NOT EXISTS users (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  username          VARCHAR(32)  NOT NULL UNIQUE,
  full_name         VARCHAR(120) NOT NULL,
  email             VARCHAR(190) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  is_verified       TINYINT(1)   NOT NULL DEFAULT 0,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One active verification code per user at a time (signup + resend overwrite it)
CREATE TABLE IF NOT EXISTS email_verifications (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  code_hash     VARCHAR(255) NOT NULL,
  expires_at    DATETIME NOT NULL,
  attempts      INT NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Generic per-user JSON data store — mirrors the original localStorage keys
-- (activities, junk, routine, routineLog, water, weight, goals, settings)
-- so the existing frontend logic barely has to change shape.
CREATE TABLE IF NOT EXISTS user_data (
  user_id     INT NOT NULL,
  data_key    VARCHAR(40) NOT NULL,
  data_value  LONGTEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, data_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leaderboard (
  user_id     INT NOT NULL PRIMARY KEY,
  points      INT NOT NULL DEFAULT 0,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
