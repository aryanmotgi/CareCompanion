-- Add updatedAt to care_profiles so the Emergency Card shows accurate last-edit date
-- Run manually via AWS Query Editor (Aurora is not publicly accessible)
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows with created_at so the column is never null
UPDATE care_profiles SET updated_at = created_at WHERE updated_at IS NULL;
