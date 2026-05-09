-- Add phase column to trial_matches (was missing, causing phase to always show N/A from cache)
ALTER TABLE trial_matches ADD COLUMN IF NOT EXISTS phase text;
