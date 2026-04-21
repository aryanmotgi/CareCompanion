ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "quiet_hours_enabled" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quiet_hours_start" text,
  ADD COLUMN IF NOT EXISTS "quiet_hours_end" text,
  ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb DEFAULT '{}';
