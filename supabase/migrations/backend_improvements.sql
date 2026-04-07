-- Backend improvements migration
-- Adds: audit_logs table, soft delete columns, shared_links table, quiet hours, health_summaries cache

-- ============================================================
-- 1. Audit Logs table — tracks all API calls
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying user's audit history
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id, created_at DESC);
-- Index for querying by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, created_at DESC);

-- RLS: users can only read their own audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own audit logs" ON audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 2. Soft delete columns — add deleted_at to existing tables
-- ============================================================
ALTER TABLE medications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Partial indexes for efficient soft-delete queries (only index non-deleted rows)
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(care_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_active ON appointments(care_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_doctors_active ON doctors(care_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lab_results_active ON lab_results(user_id) WHERE deleted_at IS NULL;

-- ============================================================
-- 3. Shared links table — for social sharing feature
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_profile_id UUID REFERENCES care_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);

ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own shared links" ON shared_links
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 4. Health summaries cache table
-- ============================================================
CREATE TABLE IF NOT EXISTS health_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_profile_id UUID REFERENCES care_profiles(id) ON DELETE CASCADE,
  summary JSONB NOT NULL,
  health_score INTEGER,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_summaries_user ON health_summaries(user_id, generated_at DESC);

ALTER TABLE health_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own health summaries" ON health_summaries
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 5. Add notification preference columns to user_settings
-- ============================================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT NULL;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE;

-- ============================================================
-- 6. Full-text search index on messages for chat search
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_content_search ON messages USING gin(to_tsvector('english', content));
