-- Backfill NULL view_count rows before adding NOT NULL constraint.
UPDATE shared_links SET view_count = 0 WHERE view_count IS NULL;
ALTER TABLE shared_links ALTER COLUMN view_count SET NOT NULL;
ALTER TABLE shared_links ALTER COLUMN view_count SET DEFAULT 0;

-- Composite index to speed up the list query (user_id, type, expires_at, revoked_at).
CREATE INDEX IF NOT EXISTS shared_links_user_type_expiry_idx
  ON shared_links (user_id, type, expires_at, revoked_at);
