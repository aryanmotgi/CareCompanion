CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  refill_reminders BOOLEAN DEFAULT true,
  appointment_reminders BOOLEAN DEFAULT true,
  lab_alerts BOOLEAN DEFAULT true,
  claim_updates BOOLEAN DEFAULT true,
  ai_personality TEXT DEFAULT 'professional' CHECK (ai_personality IN ('professional', 'friendly', 'concise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
