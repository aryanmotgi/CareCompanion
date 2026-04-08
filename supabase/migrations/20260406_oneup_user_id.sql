-- Add oneup_user_id column to user_preferences for 1upHealth integration
-- Each user gets a unique 1upHealth user ID created via their User Management API

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS oneup_user_id TEXT;

-- Index for quick lookup when redirecting to 1upHealth connect flow
CREATE INDEX IF NOT EXISTS idx_user_preferences_oneup_user_id
ON user_preferences (oneup_user_id)
WHERE oneup_user_id IS NOT NULL;
