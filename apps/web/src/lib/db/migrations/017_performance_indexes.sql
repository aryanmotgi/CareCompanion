-- Migration: 017_performance_indexes.sql
-- Source:     DB_QUERY_REPORT.md (repo root), 2026-05-18
-- Analyst:    Remote agent, static code analysis
-- !! REQUIRES psql direct connection — NOT RDS Data API !!
--    CONCURRENTLY cannot run inside an implicit transaction (RDS Data API wraps
--    every statement). Apply via:
--      psql "$DATABASE_URL" -f apps/web/src/lib/db/migrations/017_performance_indexes.sql
-- Status:     NOT YET APPLIED

-- ---------------------------------------------------------------------------
-- 1. memories_user_lastref_idx
--    Benefits: loadMemories ORDER BY last_referenced DESC LIMIT 150 after
--              adding the required `valid_to IS NULL` filter (report §1).
--    Expected latency win: eliminates full-user scan + in-memory sort;
--              ~10–50 ms saved per chat request for users with >1 k memories.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_user_lastref_idx
  ON memories(user_id, last_referenced DESC)
  WHERE valid_to IS NULL;

-- ---------------------------------------------------------------------------
-- 2. audit_logs_user_created_idx
--    Benefits: /api/compliance/audit-log paginated SELECT + COUNT(*) (report §3).
--    Expected latency win: eliminates full-table sequential scan on append-only
--              table; both the paginated query and the COUNT(*) use the index.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_user_created_idx
  ON audit_logs(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. messages_user_created_idx
--    Benefits: COUNT(*) in /api/chat/route.ts:192 (every chat request) and
--              conversation history lookups (report §6).
--    Expected latency win: eliminates growing sequential scan; at 5 k messages
--              per user this saves tens of ms on cold Aurora instance.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS messages_user_created_idx
  ON messages(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. lab_results_user_date_idx
--    Benefits: /api/chat/route.ts:148 — user + ORDER BY date_taken DESC LIMIT 20
--              fired on every chat request (report §10).
--    Expected latency win: eliminates per-user scan + sort; partial WHERE
--              excludes soft-deleted rows from the index.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS lab_results_user_date_idx
  ON lab_results(user_id, date_taken DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. symptom_entries_user_date_idx
--    Benefits: /api/chat/route.ts:172 — user + ORDER BY date DESC LIMIT 14
--              fired on every chat request (report §10).
--    Expected latency win: eliminates per-user scan + sort on a table with
--              200–1 k rows per user.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS symptom_entries_user_date_idx
  ON symptom_entries(user_id, date DESC);

-- ---------------------------------------------------------------------------
-- 6. wellness_checkins_profile_time_idx
--    Benefits: /api/export/pdf range filter on care_profile_id + checked_in_at
--              (report §5).
--    Expected latency win: replaces full-profile scan; every PDF export hits
--              this table with a date-range predicate.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS wellness_checkins_profile_time_idx
  ON wellness_checkins(care_profile_id, checked_in_at DESC);

-- ---------------------------------------------------------------------------
-- 7. symptom_insights_profile_time_idx
--    Benefits: /api/export/pdf range filter on care_profile_id + created_at
--              (report §5).
--    Expected latency win: same pattern as wellness_checkins; sequential scan
--              replaced by index range scan.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS symptom_insights_profile_time_idx
  ON symptom_insights(care_profile_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. reminder_logs_user_time_idx
--    Benefits: /api/export/pdf range filter on user_id + scheduled_time
--              (report §5).
--    Expected latency win: eliminates full-table scan in PDF export path.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS reminder_logs_user_time_idx
  ON reminder_logs(user_id, scheduled_time DESC);

-- ---------------------------------------------------------------------------
-- 9. memories_decay_at_idx
--    Benefits: nightly memory-decay cron UPDATE WHERE decay_at < NOW() AND
--              valid_to IS NULL (report §8).
--    Expected latency win: eliminates full active-memories scan (potentially
--              100 k+ rows); reduces nightly cron from multi-second scan to
--              narrow index range lookup.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS memories_decay_at_idx
  ON memories(decay_at)
  WHERE decay_at IS NOT NULL AND valid_to IS NULL;

-- ---------------------------------------------------------------------------
-- 10a. community_posts_feed_idx
--     Benefits: /api/community feed query filtered by cancer_type + ORDER BY
--               created_at DESC (report §7).
--     Expected latency win: eliminates full unmoderated-post scan + sort on
--               every community page load.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS community_posts_feed_idx
  ON community_posts(cancer_type, created_at DESC)
  WHERE is_moderated = false;

-- ---------------------------------------------------------------------------
-- 10b. community_posts_pinned_feed_idx
--     Benefits: same query when is_pinned sorting is the primary sort key
--               (report §7).
--     Expected latency win: allows pinned-post bubble-up without sort pass
--               over the full unmoderated set.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS community_posts_pinned_feed_idx
  ON community_posts(is_pinned DESC, created_at DESC)
  WHERE is_moderated = false;

-- ---------------------------------------------------------------------------
-- 11. care_team_members_profile_idx
--     Benefits: per-profile care-team lookups in /api/care-team routes
--               (report summary — zero indexes beyond PK).
--     Expected latency win: eliminates full-table scan when fetching all
--               members for a care profile.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS care_team_members_profile_idx
  ON care_team_members(care_profile_id);

-- ---------------------------------------------------------------------------
-- 12. notifications_user_unread_idx
--     Benefits: unread notification feed in /api/chat Promise.all (report
--               summary — no index on user_id / is_read).
--     Expected latency win: partial index covers the common case (unread,
--               non-deleted); eliminates full user-notification scan fired on
--               every chat request.
-- ---------------------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS notifications_user_unread_idx
  ON notifications(user_id, created_at DESC)
  WHERE is_read = false AND deleted_at IS NULL;


-- ===========================================================================
-- ROLLBACK
-- Run this section to drop all indexes added above (e.g. if a regression is
-- observed). Each DROP is also CONCURRENTLY to avoid table locks in production.
-- ===========================================================================

-- DROP INDEX CONCURRENTLY IF EXISTS memories_user_lastref_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS audit_logs_user_created_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS messages_user_created_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS lab_results_user_date_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS symptom_entries_user_date_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS wellness_checkins_profile_time_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS symptom_insights_profile_time_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS reminder_logs_user_time_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS memories_decay_at_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS community_posts_feed_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS community_posts_pinned_feed_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS care_team_members_profile_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS notifications_user_unread_idx;
