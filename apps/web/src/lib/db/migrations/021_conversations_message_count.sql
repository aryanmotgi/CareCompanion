-- Migration: 021_conversations_message_count.sql
-- Purpose:   Kill the LEFT JOIN + count(*) aggregate in GET /api/conversations
--            by denormalising message_count onto the conversations row, and
--            add covering indexes for the LEFT JOIN + WHERE/ORDER BY.
-- Status:    PENDING — apply via psql direct connection (CONCURRENTLY can't run
--            inside the implicit transaction RDS Data API wraps each call in).
--
--   psql "$DATABASE_URL" -f apps/web/src/lib/db/migrations/021_conversations_message_count.sql
--
-- Application code (apps/web/src/app/api/chat/mobile/route.ts,
--                   apps/web/src/app/api/chat/history/route.ts) maintains the
-- counter on INSERT / bulk DELETE. Cascade DELETE from conversations removes
-- both sides atomically.

-- ---------------------------------------------------------------------------
-- 1. Add column with default 0 (non-blocking on PG12+ — metadata-only)
-- ---------------------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Backfill from current messages table state
--    Safe to re-run; if rerun after the app increments live values it will
--    correct any drift introduced before the deploy.
-- ---------------------------------------------------------------------------
UPDATE conversations c
SET message_count = sub.cnt
FROM (
  SELECT conversation_id, COUNT(*)::int AS cnt
  FROM messages
  WHERE conversation_id IS NOT NULL
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id
  AND c.message_count <> sub.cnt;

-- ---------------------------------------------------------------------------
-- 3. Index covering the LEFT JOIN side (messages.conversation_id +
--    user filter). Eliminates per-conversation message-table scan in any
--    fallback aggregate query.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_conversation_user_idx
  ON messages(conversation_id, user_id)
  WHERE conversation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Index covering /api/conversations GET — WHERE user_id ORDER BY updated_at.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_user_updated_idx
  ON conversations(user_id, updated_at DESC);


-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- DROP INDEX CONCURRENTLY IF EXISTS conversations_user_updated_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS messages_conversation_user_idx;
-- ALTER TABLE conversations DROP COLUMN IF EXISTS message_count;
