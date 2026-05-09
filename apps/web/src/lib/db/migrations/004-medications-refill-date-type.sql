-- Change medications.refill_date from text to date.
-- Existing values are ISO date strings (YYYY-MM-DD) which cast directly.
-- Rows with non-date text (e.g. '') are set to NULL rather than failing.
ALTER TABLE medications
  ALTER COLUMN refill_date TYPE date
  USING CASE WHEN refill_date ~ '^\d{4}-\d{2}-\d{2}$' THEN refill_date::date ELSE NULL END;

-- Add claims.user_id index for insurance page performance.
CREATE INDEX IF NOT EXISTS claims_user_id_idx ON claims (user_id);
