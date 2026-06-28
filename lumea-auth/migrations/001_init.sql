-- ─────────────────────────────────────────────────────────────────────────────
-- Lumea Auth Service — Initial Schema
-- Run once against your PostgreSQL database before starting the service.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Schema ────────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE auth.auth_provider   AS ENUM ('LOCAL', 'GOOGLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auth.user_role       AS ENUM ('USER', 'EDITOR', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auth.supporter_status AS ENUM (
    'NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'LIFETIME', 'FOUNDING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── auth.users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.users (
  id                          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email                       TEXT          NOT NULL UNIQUE,
  password_hash               TEXT,
  username                    TEXT          NOT NULL UNIQUE,
  name                        TEXT,
  first_name                  TEXT,
  last_name                   TEXT,
  profile_picture             TEXT,
  cover_image                 TEXT,
  bio                         TEXT,
  tagline                     TEXT,
  auth_provider               auth.auth_provider    NOT NULL DEFAULT 'LOCAL',
  role                        auth.user_role         NOT NULL DEFAULT 'USER',
  is_verified                 BOOLEAN       NOT NULL DEFAULT FALSE,
  email_verified              BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Gamification
  ink_score                   INTEGER       NOT NULL DEFAULT 0,
  badges                      JSONB         NOT NULL DEFAULT '[]',
  followers_count             INTEGER       NOT NULL DEFAULT 0,
  following_count             INTEGER       NOT NULL DEFAULT 0,

  -- Monetization
  is_partner                  BOOLEAN       NOT NULL DEFAULT FALSE,
  supporter_status            auth.supporter_status NOT NULL DEFAULT 'NONE',
  supporter_expiry_date       TIMESTAMPTZ,
  earnings_balance            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_earned                NUMERIC(12,2) NOT NULL DEFAULT 0,
  upi_id                      TEXT,
  bank_account_number         TEXT,
  ifsc_code                   TEXT,
  account_holder_name         TEXT,

  -- Platform restrictions
  is_banned                   BOOLEAN       NOT NULL DEFAULT FALSE,
  strikes                     INTEGER       NOT NULL DEFAULT 0,
  posts_published_this_month  INTEGER       NOT NULL DEFAULT 0,
  last_publish_window_start   TIMESTAMPTZ,
  is_commenting_restricted    BOOLEAN       NOT NULL DEFAULT FALSE,
  commenting_restriction_end  TIMESTAMPTZ,
  commenting_restriction_reason TEXT,

  -- Interests & socials
  interests                   JSONB         NOT NULL DEFAULT '[]',
  twitter                     TEXT,
  github                      TEXT,
  linkedin                    TEXT,
  website                     TEXT,

  joined_at                   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_login_at               TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON auth.users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON auth.users (username);
CREATE INDEX IF NOT EXISTS idx_users_role     ON auth.users (role);

CREATE OR REPLACE FUNCTION auth.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON auth.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.set_updated_at();

-- ── auth.follows ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.follows (
  follower_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower  ON auth.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON auth.follows (following_id);

-- ── auth.sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth.sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jti        TEXT        NOT NULL UNIQUE,
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jti     ON auth.sessions (jti);
