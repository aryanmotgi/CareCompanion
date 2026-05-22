-- Add body_mass column to wellness_vitals for HealthKit weight tracking.
-- Enables >5% weight-loss detection over 90-day windows surfaced in chat context.
--
-- Status: PENDING — run via RDS Query Editor before merging PR.

ALTER TABLE wellness_vitals ADD COLUMN IF NOT EXISTS body_mass numeric;
