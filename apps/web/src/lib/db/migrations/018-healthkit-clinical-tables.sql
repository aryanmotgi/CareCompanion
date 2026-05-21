-- HealthKit clinical-record persistence: condition, allergy, procedure, immunization.
-- Mobile normaliser (apps/mobile/src/services/internal/normalizers.ts) already parses
-- all 7 HKClinicalTypeIdentifiers, but the sync route only persisted 4 — the other 4
-- were silently dropped at the switch statement. These tables close that gap.
--
-- Schema mirrors medications / appointments: careProfileId FK + healthkit_fhir_id UNIQUE
-- for idempotent upsert, deleted_at for the replace-endpoint soft-delete pattern.

CREATE TABLE IF NOT EXISTS conditions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id    uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  code               text,
  display            text        NOT NULL,
  clinical_status    text,
  onset_date_time    timestamptz,
  healthkit_fhir_id  text        UNIQUE,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conditions_care_profile_id_idx ON conditions(care_profile_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS allergies (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id    uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  code               text,
  display            text        NOT NULL,
  reaction           text,
  criticality        text,
  healthkit_fhir_id  text        UNIQUE,
  deleted_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS allergies_care_profile_id_idx ON allergies(care_profile_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS procedures (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id       uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  code                  text,
  display               text        NOT NULL,
  performed_date_time   timestamptz,
  healthkit_fhir_id     text        UNIQUE,
  deleted_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS procedures_care_profile_id_idx ON procedures(care_profile_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS immunizations (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id        uuid        NOT NULL REFERENCES care_profiles(id) ON DELETE CASCADE,
  code                   text,
  display                text        NOT NULL,
  occurrence_date_time   timestamptz,
  healthkit_fhir_id      text        UNIQUE,
  deleted_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS immunizations_care_profile_id_idx ON immunizations(care_profile_id) WHERE deleted_at IS NULL;
