-- Migration: 022_app_version_config.sql
-- Purpose:   Stores mobile app version gating config (force-update + kill-switch).
--            The /api/version endpoint reads these rows and merges with env overrides.
--
--   psql "$DATABASE_URL" -f apps/web/src/lib/db/migrations/022_app_version_config.sql
--
-- To change live config without redeploying, UPDATE the relevant row.
-- Env vars (APP_MIN_IOS_BUILD, etc.) always override these values if set.

CREATE TABLE IF NOT EXISTS app_version_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults — safe to re-run (ON CONFLICT DO NOTHING).
INSERT INTO app_version_config (key, value) VALUES
  ('min_ios_build',     '1'),
  ('min_android_build', '1'),
  ('latest_build',      '1'),
  ('kill_switch',       'false'),
  ('kill_reason',       ''),
  ('message',           '')
ON CONFLICT (key) DO NOTHING;


-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- DROP TABLE IF EXISTS app_version_config;
