ALTER TABLE care_profiles
  ADD COLUMN IF NOT EXISTS mood_check_in  text,
  ADD COLUMN IF NOT EXISTS support_style  text;
