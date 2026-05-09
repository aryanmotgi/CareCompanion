-- Add revoked_at to shared_links for share link revocation feature.
-- Also add revoked_at to invites table (schema.ts line 569) for invite revocation.
-- IF NOT EXISTS is safe to re-run if column was added manually.
ALTER TABLE shared_links
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE invites
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
