-- Migration: Add missing user_settings columns and fix FK references
-- These columns exist in the Drizzle schema but were never added via migration,
-- causing the Settings page to crash when trying to INSERT a new user_settings row.

-- Add quiet_hours_enabled column (missing from backend_improvements.sql)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN DEFAULT FALSE;

-- Add notification_preferences JSONB column (missing from all migrations)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';

-- Ensure updated_at column exists (needed for schema compatibility)
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Add type and title columns to shared_links (added in schema but not in migration)
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'health_summary';
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
