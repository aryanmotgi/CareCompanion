-- Memory upgrade v2: schema additions for hybrid retrieval + safety
-- See docs/superpowers/plans/2026-05-15-memory-upgrade-v2.md Chunk 2 Day 2.
-- Run inside a single transaction. Indexes live in 015 (CONCURRENT).

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- date_of_birth already exists on care_profiles via migration 010.

-- Memories: new columns (additive, NULL-safe defaults)
ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS embedding halfvec(768),
  ADD COLUMN IF NOT EXISTS fact_tsv tsvector,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS valid_to   timestamptz,
  ADD COLUMN IF NOT EXISTS polarity   text NOT NULL DEFAULT 'asserted'
    CHECK (polarity IN ('asserted','negated')),
  ADD COLUMN IF NOT EXISTS status     text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','historical','denied')),
  ADD COLUMN IF NOT EXISTS subject    text NOT NULL DEFAULT 'patient'
    CHECK (subject IN ('patient','caregiver','family')),
  ADD COLUMN IF NOT EXISTS importance numeric(2,1) NOT NULL DEFAULT 0.5
    CHECK (importance >= 0.0 AND importance <= 1.0),
  ADD COLUMN IF NOT EXISTS seen_count integer NOT NULL DEFAULT 1
    CHECK (seen_count >= 1),
  ADD COLUMN IF NOT EXISTS tier       integer NOT NULL DEFAULT 3
    CHECK (tier IN (1,2,3)),
  ADD COLUMN IF NOT EXISTS trust      numeric(2,1) NOT NULL DEFAULT 0.5
    CHECK (trust >= 0.0 AND trust <= 1.0),
  ADD COLUMN IF NOT EXISTS decay_at   timestamptz,
  ADD COLUMN IF NOT EXISTS cycle_number integer,
  ADD COLUMN IF NOT EXISTS lab_value_numeric numeric,
  ADD COLUMN IF NOT EXISTS lab_value_unit text,
  ADD COLUMN IF NOT EXISTS measured_at timestamptz,
  ADD COLUMN IF NOT EXISTS severity integer
    CHECK (severity IS NULL OR (severity >= 0 AND severity <= 10)),
  -- Slug for stable eval fixture keying (Day 5)
  ADD COLUMN IF NOT EXISTS slug text;

-- Populate fact_tsv from existing fact text (one-shot — not a generated column
-- to avoid synchronous table rewrite on a populated table)
UPDATE memories SET fact_tsv = to_tsvector('english', fact) WHERE fact_tsv IS NULL;

-- Trigger keeps fact_tsv current on insert/update
CREATE OR REPLACE FUNCTION memories_fact_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.fact_tsv := to_tsvector('english', NEW.fact);
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memories_fact_tsv_update ON memories;
CREATE TRIGGER memories_fact_tsv_update
  BEFORE INSERT OR UPDATE OF fact ON memories
  FOR EACH ROW EXECUTE FUNCTION memories_fact_tsv_trigger();

-- Audit log (HIPAA)
CREATE TABLE IF NOT EXISTS memory_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_ids uuid[] NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS memory_access_log_user_idx
  ON memory_access_log(user_id, created_at DESC);

-- Daily token tracking
CREATE TABLE IF NOT EXISTS user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cache_create_tokens integer NOT NULL DEFAULT 0,
  reserved_input_tokens integer NOT NULL DEFAULT 0,
  model_calls integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, usage_date)
);
CREATE INDEX IF NOT EXISTS user_usage_user_date_idx
  ON user_usage(user_id, usage_date DESC);

-- Conversation summaries embedding column
ALTER TABLE conversation_summaries
  ADD COLUMN IF NOT EXISTS embedding halfvec(768);
