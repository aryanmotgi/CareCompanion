-- Wellness vitals: objective HealthKit snapshots (steps, heart rate, sleep
-- hours) posted from the mobile app every 6 hours via background fetch
-- (apps/mobile/src/services/wellnessVitals.ts).
--
-- Distinct from `wellness_checkins` which holds subjective user-reported
-- mood/pain/energy/sleep enum values. This table is append-only — each row
-- is a moment-in-time HK read.
--
-- Run via psql or RDS Query Editor (no CONCURRENTLY usage).

CREATE TABLE IF NOT EXISTS wellness_vitals (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id  uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  captured_at      timestamptz NOT NULL,
  steps            integer,
  heart_rate       numeric,
  sleep_hours      numeric,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wellness_vitals_profile_time_idx
  ON wellness_vitals(care_profile_id, captured_at DESC);
