-- Add directionIsGood column to lab_results for trend direction display
ALTER TABLE lab_results ADD COLUMN IF NOT EXISTS direction_is_good boolean;
