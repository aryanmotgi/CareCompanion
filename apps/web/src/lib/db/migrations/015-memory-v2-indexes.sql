-- Memory upgrade v2: indexes. Runner-compatible (no CONCURRENTLY — RDS Data
-- API wraps each statement in its own transaction). Apply AFTER 014.
--
-- Trade-off: brief table lock during each index build. Acceptable on dev /
-- current memories row count. Future prod cutover may want to apply these
-- via psql with CONCURRENTLY for zero-lock.

CREATE INDEX IF NOT EXISTS memories_embedding_idx
  ON memories USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 200);

CREATE INDEX IF NOT EXISTS memories_fact_tsv_idx
  ON memories USING GIN (fact_tsv);

CREATE INDEX IF NOT EXISTS memories_user_valid_idx
  ON memories(user_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS memories_tier_user_idx
  ON memories(user_id, tier) WHERE valid_to IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS memories_slug_user_idx
  ON memories(user_id, slug) WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversation_summaries_embedding_idx
  ON conversation_summaries USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 200);
