-- CareCompanion Auth & Onboarding Redesign — Aurora Migration
-- Run manually via AWS Query Editor BEFORE deploying the new code.
-- Aurora is not publicly accessible; drizzle-kit push fails silently.

-- 1. New column on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;

-- 2. New columns on care_profiles
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS caregiving_experience TEXT;
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS primary_concern TEXT;
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS field_overrides JSONB;

-- 3. care_groups table
CREATE TABLE IF NOT EXISTS care_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for name+password join lookup (avoids full table scan)
CREATE INDEX IF NOT EXISTS care_groups_name_pwd_idx ON care_groups(name, password_hash);

-- 4. care_group_members table
CREATE TABLE IF NOT EXISTS care_group_members (
  care_group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (care_group_id, user_id)
);

-- 5. care_group_invites table
CREATE TABLE IF NOT EXISTS care_group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
