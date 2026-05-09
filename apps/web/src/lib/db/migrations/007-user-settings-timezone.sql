-- Add timezone to user_settings so quiet hours enforcement uses the user's local timezone
-- Run manually via AWS Query Editor
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
