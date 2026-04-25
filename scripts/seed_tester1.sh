#!/bin/bash

# Seed script for tester1@test.carecompanionai.org
# Password: CareTest2026!
# User ID: 5e85c763-c0ac-481c-bca4-911b8daf1b3d
# Care Profile ID: deb584e9-2bf4-4960-b5b4-441244815f85

RESOURCE_ARN="arn:aws:rds:us-east-1:136455701483:cluster:database-3"
SECRET_ARN="arn:aws:secretsmanager:us-east-1:136455701483:secret:carecompanion/db-SHzJzs"
DB="carecompanion"
REGION="us-east-1"
USER_ID="5e85c763-c0ac-481c-bca4-911b8daf1b3d"
PROFILE_ID="deb584e9-2bf4-4960-b5b4-441244815f85"

run() {
  aws rds-data execute-statement \
    --resource-arn "$RESOURCE_ARN" \
    --secret-arn "$SECRET_ARN" \
    --database "$DB" \
    --region "$REGION" \
    --sql "$1" 2>&1
  sleep 0.5
}

echo "🔐 Resetting password to CareTest2026!..."
run "UPDATE users SET password_hash='\$2b\$12\$JVK60NCZtGAGAuqEpTfOb.N8QgByV34ExOSW96RKBVKLzKstTkjZm', hipaa_consent=true, hipaa_consent_at=NOW(), hipaa_consent_version='1.0' WHERE id='$USER_ID';"

echo "👤 Updating care profile..."
run "UPDATE care_profiles SET
  patient_name='Margaret Chen',
  patient_age=58,
  cancer_type='Breast Cancer',
  cancer_stage='Stage III',
  treatment_phase='active_treatment',
  conditions='Hypertension, Type 2 Diabetes',
  allergies='Penicillin, Sulfa drugs',
  emergency_contact_name='David Chen',
  emergency_contact_phone='(650) 555-0142',
  onboarding_completed=true,
  role='patient',
  checkin_streak=12,
  caregiver_for_name=NULL
WHERE id='$PROFILE_ID';"

echo "🗑️  Clearing old data..."
run "DELETE FROM medications WHERE care_profile_id='$PROFILE_ID';"
run "DELETE FROM appointments WHERE care_profile_id='$PROFILE_ID';"
run "DELETE FROM doctors WHERE care_profile_id='$PROFILE_ID';"
run "DELETE FROM lab_results WHERE user_id='$USER_ID';"
run "DELETE FROM symptom_entries WHERE user_id='$USER_ID';"
run "DELETE FROM notifications WHERE user_id='$USER_ID';"
run "DELETE FROM treatment_cycles WHERE care_profile_id='$PROFILE_ID';"
run "DELETE FROM insurance WHERE user_id='$USER_ID';"

echo "💊 Adding medications..."
run "INSERT INTO medications (id, care_profile_id, name, dose, frequency, prescribing_doctor, refill_date, notes) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 'Tamoxifen', '20mg', 'Once daily', 'Dr. Sarah Patel', '2026-05-15', 'Take with food. Hormone therapy for ER+ breast cancer.'),
  (gen_random_uuid(), '$PROFILE_ID', 'Metformin', '500mg', 'Twice daily with meals', 'Dr. James Okafor', '2026-05-01', 'For diabetes management during treatment'),
  (gen_random_uuid(), '$PROFILE_ID', 'Ondansetron', '8mg', 'As needed for nausea', 'Dr. Sarah Patel', '2026-05-20', 'Take 30 min before chemo or when nausea occurs'),
  (gen_random_uuid(), '$PROFILE_ID', 'Lisinopril', '10mg', 'Once daily in morning', 'Dr. James Okafor', '2026-05-10', 'Blood pressure management'),
  (gen_random_uuid(), '$PROFILE_ID', 'Dexamethasone', '4mg', 'Day before, day of, day after chemo', 'Dr. Sarah Patel', '2026-05-22', 'Anti-nausea and inflammation. Do not stop suddenly.'),
  (gen_random_uuid(), '$PROFILE_ID', 'Lorazepam', '0.5mg', 'As needed for anxiety', 'Dr. Sarah Patel', '2026-06-01', 'For chemo-related anxiety. Max 2 tablets/day.');"

echo "🏥 Adding doctors..."
run "INSERT INTO doctors (id, care_profile_id, name, specialty, phone, notes) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 'Dr. Sarah Patel', 'Medical Oncologist', '(650) 555-0101', 'Primary oncologist at Stanford Cancer Center. Leads chemo protocol.'),
  (gen_random_uuid(), '$PROFILE_ID', 'Dr. Michael Torres', 'Breast Surgeon', '(650) 555-0102', 'Performed lumpectomy in January. Follow-up every 3 months.'),
  (gen_random_uuid(), '$PROFILE_ID', 'Dr. James Okafor', 'Primary Care Physician', '(650) 555-0103', 'Managing diabetes and hypertension during treatment'),
  (gen_random_uuid(), '$PROFILE_ID', 'Dr. Linda Chow', 'Radiation Oncologist', '(650) 555-0104', 'Radiation therapy scheduled post-chemo. 6-week course.');"

echo "📅 Adding appointments..."
run "INSERT INTO appointments (id, care_profile_id, purpose, doctor_name, date_time, location) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 'Chemotherapy — Cycle 4 of 6', 'Dr. Sarah Patel', NOW() + INTERVAL '2 days', 'Stanford Cancer Center, Infusion Suite 3B'),
  (gen_random_uuid(), '$PROFILE_ID', 'Blood Draw & Lab Panel', 'Dr. Sarah Patel', NOW() + INTERVAL '1 day', 'Stanford Cancer Center, Lab Services'),
  (gen_random_uuid(), '$PROFILE_ID', 'Oncology Follow-up', 'Dr. Sarah Patel', NOW() + INTERVAL '14 days', 'Stanford Cancer Center, Suite 210'),
  (gen_random_uuid(), '$PROFILE_ID', 'Primary Care Check-in', 'Dr. James Okafor', NOW() + INTERVAL '7 days', 'Palo Alto Medical Foundation'),
  (gen_random_uuid(), '$PROFILE_ID', 'Radiation Planning CT Scan', 'Dr. Linda Chow', NOW() + INTERVAL '21 days', 'Stanford Radiation Oncology'),
  (gen_random_uuid(), '$PROFILE_ID', 'Post-Chemo Oncology Visit', 'Dr. Sarah Patel', NOW() + INTERVAL '42 days', 'Stanford Cancer Center, Suite 210');"

echo "🧪 Adding lab results..."
run "INSERT INTO lab_results (id, user_id, test_name, value, unit, reference_range, is_abnormal, date_taken) VALUES
  (gen_random_uuid(), '$USER_ID', 'WBC (White Blood Cell Count)', '3.2', 'K/μL', '4.5-11.0', true, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'Hemoglobin', '10.8', 'g/dL', '12.0-16.0', true, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'Platelets', '142', 'K/μL', '150-400', true, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'Absolute Neutrophil Count', '1.8', 'K/μL', '1.8-7.7', false, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'CA 15-3 (Tumor Marker)', '42', 'U/mL', '<31', true, (NOW() - INTERVAL '14 days')::date),
  (gen_random_uuid(), '$USER_ID', 'CEA (Tumor Marker)', '3.8', 'ng/mL', '<3.0', true, (NOW() - INTERVAL '14 days')::date),
  (gen_random_uuid(), '$USER_ID', 'Creatinine', '0.9', 'mg/dL', '0.6-1.2', false, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'ALT (Liver Enzyme)', '38', 'U/L', '7-40', false, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'Blood Glucose (Fasting)', '142', 'mg/dL', '70-100', true, (NOW() - INTERVAL '7 days')::date),
  (gen_random_uuid(), '$USER_ID', 'HbA1c', '7.4', '%', '<5.7', true, (NOW() - INTERVAL '30 days')::date);"

echo "😔 Adding symptom entries..."
run "DELETE FROM symptom_entries WHERE user_id='$USER_ID';"
run "INSERT INTO symptom_entries (id, user_id, care_profile_id, date, pain_level, mood, sleep_hours, sleep_quality, energy, appetite, symptoms, notes) VALUES
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', NOW()::date, 3, 'okay', 6.5, 'fair', 'low', 'fair', ARRAY['fatigue','mild_nausea'], 'Day 5 post-chemo. Fatigue improving but still tired. Nausea manageable with Zofran. Got out of bed for lunch — small win.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '1 day')::date, 4, 'poor', 5.0, 'poor', 'very_low', 'poor', ARRAY['fatigue','nausea','headache'], 'Rough day. Chemo side effects peaking. Stayed in bed most of the day. David brought soup — helped a little.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '2 days')::date, 6, 'poor', 4.5, 'poor', 'very_low', 'poor', ARRAY['fatigue','nausea','vomiting','hair_loss'], 'Worst day of this cycle. Vomited twice in the morning. Called nurses line — advised to keep hydrated and rest. Found more hair on pillow.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '3 days')::date, 5, 'okay', 5.5, 'fair', 'low', 'fair', ARRAY['fatigue','nausea','mouth_sores'], 'Chemo day — Cycle 4. Nausea started about 4 hours in. Mouth feeling a bit raw. The nurses were wonderful today.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '4 days')::date, 2, 'good', 7.0, 'good', 'moderate', 'good', ARRAY['mild_fatigue'], 'Pre-chemo prep. Fasting for morning lab draw. Feeling anxious but trying to stay positive. Did some light stretching.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '5 days')::date, 2, 'good', 7.5, 'good', 'moderate', 'good', ARRAY['mild_fatigue'], 'Good energy day. Took a 20-minute walk with David around the neighborhood. First walk in 10 days — felt amazing.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '6 days')::date, 1, 'great', 8.0, 'good', 'good', 'good', ARRAY[]::text[], 'Feeling almost normal today. Made breakfast myself. Did some light reading. This is what I am fighting for.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '7 days')::date, 2, 'good', 7.0, 'good', 'moderate', 'good', ARRAY['mild_fatigue'], 'End of week 3. Much better than last week. Appetite back. Had a real dinner with David and the kids — needed this.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '9 days')::date, 3, 'okay', 6.0, 'fair', 'low', 'fair', ARRAY['fatigue','peripheral_neuropathy'], 'Tingling in fingers and toes today — asked Dr. Patel about it, she says it is from Taxol. Should improve after treatment ends.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '10 days')::date, 4, 'poor', 5.5, 'poor', 'low', 'poor', ARRAY['fatigue','nausea','bone_pain'], 'Bone pain from the Neulasta shot. Worse in my lower back. Ice pack helped. Counting days until this cycle ends.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '11 days')::date, 5, 'poor', 4.0, 'poor', 'very_low', 'poor', ARRAY['fatigue','nausea','bone_pain','chemo_fog'], 'Cycle 3 aftermath. Brain fog is real — could not remember where I put my keys for an hour. Forgave myself.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '14 days')::date, 2, 'great', 7.5, 'good', 'good', 'good', ARRAY[]::text[], 'Feeling almost normal. Energy returning in week 3 of Cycle 3. Video call with my sister — she makes me laugh.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '17 days')::date, 3, 'okay', 6.5, 'fair', 'moderate', 'fair', ARRAY['fatigue','mild_nausea'], 'Getting through it. Day by day. Grateful for everyone checking in.'),
  (gen_random_uuid(), '$USER_ID', '$PROFILE_ID', (NOW() - INTERVAL '21 days')::date, 2, 'good', 8.0, 'good', 'good', 'good', ARRAY['mild_fatigue']::text[], 'Pre-Cycle 3. Feeling strong going in. Blood counts looked good this week. Ready to fight.');"

echo "👥 Adding care team members (self + family supporters)..."
run "DELETE FROM care_team_members WHERE care_profile_id='$PROFILE_ID';"
run "DELETE FROM care_team_activity WHERE care_profile_id='$PROFILE_ID';"

# Ensure Margaret herself is an owner member
run "INSERT INTO care_team_members (id, care_profile_id, user_id, role, joined_at) VALUES
  (gen_random_uuid(), '$PROFILE_ID', '$USER_ID', 'owner', NOW())
  ON CONFLICT DO NOTHING;"

# Create/update David Chen (caregiver husband) as a supporter
run "INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000001', 'david.chen@family.test', 'David Chen', '\$2b\$12\$placeholder')
  ON CONFLICT (email) DO UPDATE SET display_name='David Chen';"

run "INSERT INTO care_team_members (id, care_profile_id, user_id, role, joined_at) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 'a1b2c3d4-0000-0000-0000-000000000001', 'caregiver', NOW() - INTERVAL '60 days')
  ON CONFLICT DO NOTHING;"

# Create Jennifer Chen (daughter) as a viewer
run "INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('a1b2c3d4-0000-0000-0000-000000000002', 'jennifer.chen@family.test', 'Jennifer Chen', '\$2b\$12\$placeholder')
  ON CONFLICT (email) DO UPDATE SET display_name='Jennifer Chen';"

run "INSERT INTO care_team_members (id, care_profile_id, user_id, role, joined_at) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 'a1b2c3d4-0000-0000-0000-000000000002', 'viewer', NOW() - INTERVAL '45 days')
  ON CONFLICT DO NOTHING;"

# Add activity log entries
run "INSERT INTO care_team_activity (id, care_profile_id, user_id, user_name, action) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 'a1b2c3d4-0000-0000-0000-000000000001', 'David Chen', 'Updated medication log for Ondansetron'),
  (gen_random_uuid(), '$PROFILE_ID', 'a1b2c3d4-0000-0000-0000-000000000002', 'Jennifer Chen', 'Viewed appointment schedule'),
  (gen_random_uuid(), '$PROFILE_ID', '$USER_ID', 'Margaret Chen', 'Added journal entry'),
  (gen_random_uuid(), '$PROFILE_ID', 'a1b2c3d4-0000-0000-0000-000000000001', 'David Chen', 'Marked Tamoxifen as taken');"

echo "🔔 Adding notifications..."
run "INSERT INTO notifications (id, user_id, type, title, message, is_read) VALUES
  (gen_random_uuid(), '$USER_ID', 'appointment_reminder', 'Lab Draw Tomorrow', 'Pre-chemo blood draw at Stanford Cancer Center. Fasting required after midnight.', false),
  (gen_random_uuid(), '$USER_ID', 'medication_reminder', 'Dexamethasone Tonight', 'Take Dexamethasone 4mg tonight — one day before chemo (Cycle 4). Helps prevent nausea.', false),
  (gen_random_uuid(), '$USER_ID', 'refill_reminder', 'Tamoxifen Refill Due May 15', 'Your Tamoxifen prescription refill is due in 3 weeks.', false),
  (gen_random_uuid(), '$USER_ID', 'lab_alert', 'Low WBC — Watch for Fever', 'Your WBC (3.2 K/μL) is below normal. Call care team if temp reaches 100.4°F.', false);"

echo "🏥 Adding insurance..."
run "INSERT INTO insurance (id, user_id, provider, member_id, group_number, deductible_limit, deductible_used, oop_limit, oop_used, plan_year) VALUES
  (gen_random_uuid(), '$USER_ID', 'Blue Shield of California', 'BSC-4821937', 'GRP-90234', 3000, 2100, 7500, 4200, 2026);"

echo "🔄 Adding treatment cycle..."
run "INSERT INTO treatment_cycles (id, care_profile_id, cycle_number, start_date, cycle_length_days, regimen_name, notes, is_active) VALUES
  (gen_random_uuid(), '$PROFILE_ID', 4, '2026-04-22', 21, 'AC-T (Adriamycin, Cyclophosphamide + Taxol)', 'Cycle 4 of 6. Adriamycin 60mg/m² + Cyclophosphamide 600mg/m² on Day 1. Taxol follows after first 4 cycles.', true);"

echo "✅ Seed complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📧 Email:    tester1@test.carecompanionai.org"
echo "🔑 Password: CareTest2026!"
echo "👤 Patient:  Margaret Chen, 58F"
echo "🎗️  Cancer:   Breast Cancer, Stage III"
echo "💊 Meds:     6 medications"
echo "📅 Appts:    6 appointments"
echo "🧪 Labs:     10 lab results"
echo "🏥 Doctors:  4 care team members"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
