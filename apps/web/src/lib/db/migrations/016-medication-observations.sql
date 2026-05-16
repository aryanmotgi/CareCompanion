-- Medication observations: caregiver-reported dose events + discrepancy tracking
-- Each row is one observation (dose taken, skipped, etc.) by a caregiver.
-- The EHR/prescribed dose is snapshotted at observation time — neither record
-- overwrites the other. Resolution requires an explicit action from the caregiver
-- or a future clinical reviewer.
--
-- Discrepancy detection runs at write time in the API layer; this table
-- stores the result. See /api/records/medication-observations for logic.

CREATE TABLE IF NOT EXISTS medication_observations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id     uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  medication_id       uuid        NOT NULL REFERENCES medications(id)   ON DELETE CASCADE,
  reported_by         uuid        NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  reported_at         timestamptz NOT NULL DEFAULT NOW(),

  -- What the caregiver observed
  observation_type    text        NOT NULL
    CHECK (observation_type IN ('dose_taken', 'dose_skipped', 'dose_partial', 'dose_delayed', 'other')),
  dose_reported       text,                      -- null when skipped/other
  notes               text,

  -- Discrepancy snapshot (populated only when discrepancy_flag = true)
  discrepancy_flag    boolean     NOT NULL DEFAULT false,
  discrepancy_type    text
    CHECK (discrepancy_type IN ('DOSE_DIFFERS', 'MED_NOT_IN_EHR', 'DOSE_SKIPPED')),
  ehr_dose_at_time    text,                      -- snapshot of medications.dose at observation time

  -- Resolution (null until actioned)
  resolved_at         timestamptz,
  resolved_by         uuid        REFERENCES users(id),
  resolution_action   text
    CHECK (resolution_action IN ('intentional_change', 'caregiver_error', 'clinical_review_needed', 'no_action')),
  resolution_notes    text,

  created_at          timestamptz NOT NULL DEFAULT NOW()
);

-- Fetch all observations for a care profile, newest first
CREATE INDEX IF NOT EXISTS medication_observations_care_profile_idx
  ON medication_observations(care_profile_id, reported_at DESC);

-- Fetch open discrepancies quickly
CREATE INDEX IF NOT EXISTS medication_observations_discrepancy_idx
  ON medication_observations(care_profile_id, discrepancy_flag)
  WHERE discrepancy_flag = true AND resolved_at IS NULL;

-- Fetch all observations for a specific medication
CREATE INDEX IF NOT EXISTS medication_observations_medication_idx
  ON medication_observations(medication_id, reported_at DESC);
