-- Memory upgrade v2: concurrent indexes (separate file — must run outside a
-- transaction). Apply AFTER 014-memory-v2-schema.sql finishes.

CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_embedding_idx
  ON memories USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 200);

CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_fact_tsv_idx
  ON memories USING GIN (fact_tsv);

CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_user_valid_idx
  ON memories(user_id) WHERE valid_to IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_tier_user_idx
  ON memories(user_id, tier) WHERE valid_to IS NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS memories_slug_user_idx
  ON memories(user_id, slug) WHERE slug IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_summaries_embedding_idx
  ON conversation_summaries USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 200);
