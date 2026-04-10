/**
 * Creates a pre-seeded reviewer account for 1upHealth approval review.
 *
 * Run with: npx tsx scripts/create-reviewer-account.ts
 *
 * Requires these env vars:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env.local manually (no dotenv dependency needed)
try {
  const envFile = readFileSync('.env.local', 'utf-8');
  envFile.split('\n').forEach((line) => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      if (!process.env[key]) process.env[key] = value.replace(/^["']|["']$/g, '');
    }
  });
} catch {
  // .env.local not found, rely on existing env
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure .env.local is set up correctly.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REVIEWER_EMAIL = 'reviewer@carecompanionai.org';
const REVIEWER_PASSWORD = 'OneUpReview2026!';

async function main() {
  console.log('--- Creating reviewer account ---\n');

  // 1. Delete existing reviewer account if it exists
  console.log('Step 1: Checking for existing reviewer account...');
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === REVIEWER_EMAIL);

  if (existing) {
    console.log(`   Found existing account (${existing.id}). Deleting...`);
    await admin.auth.admin.deleteUser(existing.id);
    console.log('   Deleted.');
  } else {
    console.log('   No existing account found.');
  }

  // 2. Create the new reviewer user
  console.log('\nStep 2: Creating new reviewer user...');
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: REVIEWER_EMAIL,
    password: REVIEWER_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Reviewer Account',
    },
  });

  if (createError || !newUser?.user) {
    console.error('   FAILED:', createError?.message);
    process.exit(1);
  }

  const userId = newUser.user.id;
  console.log(`   Created user with ID: ${userId}`);

  // 3. Create care profile with HER2+ Breast Cancer data
  console.log('\nStep 3: Creating care profile...');
  const { data: profile, error: profileError } = await admin
    .from('care_profiles')
    .insert({
      user_id: userId,
      patient_name: 'Sarah Mitchell',
      patient_age: 58,
      relationship: 'self',
      cancer_type: 'HER2+ Breast Cancer',
      cancer_stage: 'Stage IIIA',
      treatment_phase: 'active_treatment',
      conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nOsteoporosis\nAnxiety',
      allergies: 'Sulfa drugs\nLatex\nIbuprofen (causes GI upset)',
      onboarding_completed: true,
    })
    .select('id')
    .single();

  if (profileError || !profile) {
    console.error('   FAILED:', profileError?.message);
    process.exit(1);
  }
  console.log(`   Created profile with ID: ${profile.id}`);

  const now = new Date();
  const day = (d: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + d);
    return x;
  };
  const dayISO = (d: number) => day(d).toISOString().split('T')[0];
  const dayTime = (d: number, h: number, m: number) => {
    const x = day(d);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };

  // 4. Seed medications
  console.log('\nStep 4: Seeding 8 medications...');
  await admin.from('medications').insert([
    { care_profile_id: profile.id, name: 'Trastuzumab (Herceptin)', dose: '440mg', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Pertuzumab (Perjeta)', dose: '840mg', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Docetaxel (Taxotere)', dose: '75mg/m²', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'As needed for nausea', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(3), quantity_remaining: 12, notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Dexamethasone', dose: '4mg', frequency: 'Before chemo infusion', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), quantity_remaining: 6, notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Tamoxifen', dose: '20mg', frequency: 'Once daily', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(25), quantity_remaining: 30, notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily — morning', prescribing_doctor: 'Dr. Maria Santos (Primary Care)', refill_date: dayISO(20), quantity_remaining: 24, notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Lorazepam (Ativan)', dose: '0.5mg', frequency: 'As needed for anxiety', prescribing_doctor: 'Dr. Maria Santos (Primary Care)', refill_date: dayISO(30), quantity_remaining: 15, notes: 'Reviewer demo data' },
  ]);

  // 5. Seed lab results
  console.log('Step 5: Seeding 7 lab results...');
  await admin.from('lab_results').insert([
    { user_id: userId, test_name: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Reviewer demo data' },
    { user_id: userId, test_name: 'HER2/neu', value: '15.8', unit: 'ng/mL', reference_range: '<15.0', is_abnormal: true, date_taken: day(-5).toISOString(), source: 'Reviewer demo data' },
    { user_id: userId, test_name: 'CA 15-3', value: '28.5', unit: 'U/mL', reference_range: '<30', is_abnormal: false, date_taken: day(-5).toISOString(), source: 'Reviewer demo data' },
    { user_id: userId, test_name: 'Hemoglobin', value: '11.2', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Reviewer demo data' },
    { user_id: userId, test_name: 'Platelet Count', value: '145', unit: 'K/uL', reference_range: '150-400', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Reviewer demo data' },
    { user_id: userId, test_name: 'Creatinine', value: '0.9', unit: 'mg/dL', reference_range: '0.6-1.2', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Reviewer demo data' },
    { user_id: userId, test_name: 'ALT', value: '22', unit: 'U/L', reference_range: '7-56', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Reviewer demo data' },
  ]);

  // 6. Seed appointments
  console.log('Step 6: Seeding 4 appointments...');
  await admin.from('appointments').insert([
    { care_profile_id: profile.id, doctor_name: 'Dr. Lisa Chen', specialty: 'Medical Oncology', date_time: dayTime(3, 10, 0), location: 'Cancer Center — Clinic 2', purpose: 'Oncology follow-up — treatment response review', notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, doctor_name: 'Lab Work', specialty: 'Laboratory', date_time: dayTime(6, 8, 0), location: 'Cancer Center — Lab', purpose: 'Pre-chemo bloodwork (CBC, CMP, tumor markers)', notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, doctor_name: 'Infusion Center', specialty: 'Medical Oncology', date_time: dayTime(7, 9, 0), location: 'Cancer Center — Infusion Suite B', purpose: 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere', notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, doctor_name: 'Dr. James Park', specialty: 'Cardiology', date_time: dayTime(14, 11, 0), location: 'Heart & Vascular Center', purpose: 'Echocardiogram — Herceptin cardiac monitoring', notes: 'Reviewer demo data' },
  ]);

  // 7. Seed doctors
  console.log('Step 7: Seeding 4 doctors...');
  await admin.from('doctors').insert([
    { care_profile_id: profile.id, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Reviewer demo data' },
    { care_profile_id: profile.id, name: 'Dr. Rachel Kim', specialty: 'Breast Surgeon', phone: '555-0204', notes: 'Reviewer demo data' },
  ]);

  // 8. Seed insurance
  console.log('Step 8: Seeding insurance...');
  await admin.from('insurance').upsert({
    user_id: userId,
    provider: 'Blue Cross Blue Shield',
    member_id: 'BCB-882991-04',
    group_number: 'GRP-7420',
    plan_year: new Date().getFullYear(),
  });

  // 9. Seed notifications
  console.log('Step 9: Seeding 3 notifications...');
  await admin.from('notifications').insert([
    { user_id: userId, type: 'lab_result', title: 'Low WBC — Neutropenia Warning', message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever or signs of infection. Contact oncology if temp > 100.4 F.', is_read: false },
    { user_id: userId, type: 'refill', title: 'Ondansetron (Zofran) refill soon', message: '12 tablets remaining. Refill due in 3 days — you will need these for your next infusion.', is_read: false },
    { user_id: userId, type: 'appointment', title: 'Oncology follow-up in 3 days', message: 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM. Review treatment response.', is_read: false },
  ]);

  // 10. Seed user settings
  console.log('Step 10: Seeding user settings...');
  await admin.from('user_settings').upsert({
    user_id: userId,
    refill_reminders: true,
    appointment_reminders: true,
    lab_alerts: true,
    claim_updates: true,
    ai_personality: 'friendly',
  });

  console.log('\n--- DONE ---');
  console.log('\nReviewer account ready:');
  console.log(`   URL:      https://carecompanionai.org/login`);
  console.log(`   Email:    ${REVIEWER_EMAIL}`);
  console.log(`   Password: ${REVIEWER_PASSWORD}`);
  console.log('\nThis account can be shared with the 1upHealth review team.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
