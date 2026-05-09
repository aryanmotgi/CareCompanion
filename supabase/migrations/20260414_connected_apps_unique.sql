-- Deduplicate connected_apps — keep only the newest row per (user_id, source)
-- then enforce the unique constraint so upserts work correctly.
DELETE FROM connected_apps
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, source) id
  FROM connected_apps
  ORDER BY user_id, source, created_at DESC
);

-- Add unique constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'connected_apps'
    AND indexname = 'connected_apps_user_source'
  ) THEN
    CREATE UNIQUE INDEX connected_apps_user_source ON connected_apps(user_id, source);
  END IF;
END $$;
