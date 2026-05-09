-- 008: Premium Care OS — wellness check-ins, symptom insights, gratitude nudges
--
-- Adds the four schema items the app expects but that were never migrated
-- on the dev Aurora cluster. Production received these manually on 2026-04-24
-- but no migration file was ever committed, leaving dev drifted.
--
-- All statements are idempotent — safe to re-run.

-- ── care_team_members: gratitude nudge tracking ─────────────────────────────
ALTER TABLE care_team_members
  ADD COLUMN IF NOT EXISTS gratitude_nudge_count integer NOT NULL DEFAULT 0;

ALTER TABLE care_team_members
  ADD COLUMN IF NOT EXISTS last_gratitude_nudge_at timestamptz;

-- ── wellness_checkins: daily caregiver wellness reports ─────────────────────
CREATE TABLE IF NOT EXISTS wellness_checkins (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id      uuid NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  reported_by_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  mood                 integer NOT NULL,            -- 1-5
  pain                 integer NOT NULL,            -- 0-10
  energy               text NOT NULL,               -- low | medium | high
  sleep                text NOT NULL,               -- bad | ok | good
  notes                text,
  checked_in_at        timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wellness_checkins_care_profile_checked_in
  ON wellness_checkins (care_profile_id, checked_in_at DESC);

-- ── symptom_insights: AI-derived trends and alerts ──────────────────────────
CREATE TABLE IF NOT EXISTS symptom_insights (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id   uuid NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  type              text NOT NULL,                  -- trend | correlation | anomaly | milestone
  severity          text NOT NULL,                  -- info | watch | alert
  status            text NOT NULL DEFAULT 'active', -- active | read | dismissed | archived
  title             text NOT NULL,
  body              text NOT NULL,
  data              jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  expires_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_symptom_insights_care_profile_status
  ON symptom_insights (care_profile_id, status, created_at DESC);
