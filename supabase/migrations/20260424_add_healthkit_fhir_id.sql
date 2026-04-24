-- Add healthkit_fhir_id column to appointments, medications, and lab_results
-- These columns were added to the Drizzle schema for HealthKit FHIR import
-- but never had a corresponding database migration.

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS healthkit_fhir_id TEXT UNIQUE;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS healthkit_fhir_id TEXT UNIQUE;
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS healthkit_fhir_id TEXT UNIQUE;
