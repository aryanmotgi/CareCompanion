-- Add Tier-1 onboarding fields needed for clinical trial matching and
-- treatment context. Run manually via AWS Query Editor.
--
-- Note: city / state / zip_code already exist on care_profiles.
ALTER TABLE care_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth   DATE,
  ADD COLUMN IF NOT EXISTS sex_at_birth    TEXT,        -- 'female' | 'male' | 'intersex' | 'prefer_not'
  ADD COLUMN IF NOT EXISTS biomarkers      JSONB,       -- { "HER2": "positive", "ER": "positive", ... } — cancer-type-specific keys
  ADD COLUMN IF NOT EXISTS diagnosis_date  DATE,
  ADD COLUMN IF NOT EXISTS ecog_status     INTEGER,     -- 0..4
  ADD COLUMN IF NOT EXISTS prior_treatments TEXT;       -- free-form for now; structure later
