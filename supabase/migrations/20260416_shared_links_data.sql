-- Add type and data columns to shared_links so we can actually store share snapshots
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'health_summary';
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}';
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS title text;
