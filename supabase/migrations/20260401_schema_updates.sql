ALTER TABLE medications ADD COLUMN IF NOT EXISTS pharmacy_phone TEXT;

ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE care_profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

CREATE POLICY "Users read own documents" ON documents FOR SELECT USING (
  care_profile_id IN (SELECT id FROM care_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users insert own documents" ON documents FOR INSERT WITH CHECK (
  care_profile_id IN (SELECT id FROM care_profiles WHERE user_id = auth.uid())
);
