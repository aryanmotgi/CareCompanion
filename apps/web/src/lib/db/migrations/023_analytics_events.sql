-- Migration: 023_analytics_events.sql
-- Purpose:   Internal product analytics — replaces PostHog.
--            All data stays inside our HIPAA-covered Aurora instance.
--
-- Notes:
--   • user_id_hash = SHA-256(user_uuid + ANALYTICS_HASH_SALT) — irreversible.
--   • properties JSONB must NEVER contain PHI. Server route enforces a
--     PHI-key blocklist before insert.
--   • Partition by month later (analytics_events_yyyy_mm) once row count
--     justifies it. For now a single table + (event_name, created_at)
--     index is enough for the first 10–50M rows.

CREATE TABLE IF NOT EXISTS analytics_events (
  id           BIGSERIAL    PRIMARY KEY,
  event_name   TEXT         NOT NULL,
  user_id_hash TEXT,
  session_id   TEXT,
  properties   JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analytics_events_event_created_idx
  ON analytics_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_hash_created_idx
  ON analytics_events (user_id_hash, created_at DESC)
  WHERE user_id_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON analytics_events (session_id)
  WHERE session_id IS NOT NULL;

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- DROP TABLE IF EXISTS analytics_events;
