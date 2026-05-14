-- Care-group join via 5-char code + caregiver onboarding (patient/caregiver split).
-- Run manually via AWS Query Editor.
--
-- The plan: see ~/.gstack/projects/aryanmotgi-CareCompanion/ceo-plans/2026-05-12-patient-caregiver-onboarding.md

-- Care group member extensions: split the existing `role` (group leadership:
-- owner|member) from the new user_type axis (patient|caregiver). Relationship +
-- per-member permissions + pause flag for the patient-facing privacy toggle.
ALTER TABLE care_group_members
  ADD COLUMN IF NOT EXISTS user_type    TEXT NOT NULL DEFAULT 'patient',  -- 'patient' | 'caregiver'
  ADD COLUMN IF NOT EXISTS relationship TEXT,                              -- 'spouse'|'parent'|'child'|'sibling'|'friend'|'other' (null for patients)
  ADD COLUMN IF NOT EXISTS perms        JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS paused       BOOLEAN NOT NULL DEFAULT FALSE;

-- Short-code invite mechanism (replaces the long-token invite for new flows;
-- old invites coexist for 30 days behind a deprecation banner).
CREATE TABLE IF NOT EXISTS care_group_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_group_id UUID NOT NULL REFERENCES care_groups(id) ON DELETE CASCADE,
  code          VARCHAR(5) NOT NULL UNIQUE,                                -- Crockford base32 minus 0/O/1/I/L/U, formatted XX-XXX on display
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  revoked_at    TIMESTAMPTZ,
  max_uses      INTEGER NOT NULL DEFAULT 5,
  use_count     INTEGER NOT NULL DEFAULT 0,
  last_used_at  TIMESTAMPTZ
);

-- Partial unique index: only one ACTIVE (non-revoked) code per group at a time.
-- Rotation revokes the old before creating the new.
CREATE UNIQUE INDEX IF NOT EXISTS care_group_codes_group_active_idx
  ON care_group_codes (care_group_id) WHERE revoked_at IS NULL;

-- Lookup index for redemption: only check active codes.
CREATE INDEX IF NOT EXISTS care_group_codes_code_active_idx
  ON care_group_codes (code) WHERE revoked_at IS NULL;

-- Caregiver-first email fallback: caregiver downloads app before patient sends a
-- code, requests join by patient's email. Patient approves or denies from
-- Settings > Care Group.
CREATE TABLE IF NOT EXISTS care_group_join_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caregiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending',                          -- 'pending' | 'approved' | 'denied' | 'expired'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  UNIQUE (patient_user_id, caregiver_user_id, status)                       -- prevents duplicate pending requests
);

CREATE INDEX IF NOT EXISTS care_group_join_requests_patient_pending_idx
  ON care_group_join_requests (patient_user_id) WHERE status = 'pending';
