/**
 * Creates the static reviewer account for 1upHealth approval team.
 *
 * Credentials shown on /demo-walkthrough (public, read-only demo account):
 *   Email:    reviewer@carecompanionai.org
 *   Password: OneUpReview2026!
 *
 * Run: npx dotenv -e .env.local -- npx tsx scripts/setup-reviewer-account.ts
 */

import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const EMAIL = 'reviewer@carecompanionai.org';
  const PASSWORD = 'OneUpReview2026!';

  // ── 1. Create or reset the auth user ──────────────────────────────────────
  const { data: listData } = await admin.auth.admin.listUsers();
  const existing = listData?.users.find((u) => u.email === EMAIL);

  let userId: string;

  if (existing) {
    console.log(`User ${EMAIL} already exists — resetting password and re-seeding data`);
    await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
    userId = existing.id;

    // Wipe existing data so we start fresh
    await admin.from('symptom_entries').delete().eq('user_id', userId);
    await admin.from('notifications').delete().eq('user_id', userId);
    await admin.from('lab_results').delete().eq('user_id', userId);
    await admin.from('reminder_logs').delete().eq('user_id', userId);
    await admin.from('medication_reminders').delete().eq('user_id', userId);

    // Delete appointments, medications, doctors via care_profile
    const { data: profiles } = await admin.from('care_profiles').select('id').eq('user_id', userId);
    for (const p of profiles || []) {
      await admin.from('appointments').delete().eq('care_profile_id', p.id);
      await admin.from('medications').delete().eq('care_profile_id', p.id);
      await admin.from('doctors').delete().eq('care_profile_id', p.id);
    }
    await admin.from('care_profiles').delete().eq('user_id', userId);
    await admin.from('insurance').delete().eq('user_id', userId);
    await admin.from('user_settings').delete().eq('user_id', userId);
  } else {
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: '1upHealth Reviewer',
        is_reviewer: true,
      },
    });

    if (error || !newUser?.user) {
      console.error('Failed to create user:', error);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`Created user ${EMAIL} (${userId})`);
  }

  // ── 2. Seed realistic HER2+ demo data ─────────────────────────────────────
  await seedDemoData(admin, userId);
  console.log('Demo data seeded successfully');
  console.log('\n✓ Reviewer account ready:');
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  URL:      https://carecompanionai.org/login`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedDemoData(admin: any, userId: string) {
  const now = new Date();
  const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
  const dayISO = (d: number) => day(d).toISOString().split('T')[0];
  const dayTime = (d: number, h: number, m: number) => {
    const x = day(d); x.setHours(h, m, 0, 0); return x.toISOString();
  };

  // Care profile
  const { data: profile, error: profileErr } = await admin.from('care_profiles').insert({
    user_id: userId,
    patient_name: 'Sarah',
    patient_age: 58,
    relationship: 'self',
    cancer_type: 'HER2+ Breast Cancer',
    cancer_stage: 'Stage IIIA',
    treatment_phase: 'active_treatment',
    conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nOsteoporosis\nAnxiety',
    allergies: 'Sulfa drugs\nLatex\nIbuprofen (causes GI upset)',
    onboarding_completed: true,
  }).select('id').single();

  if (profileErr || !profile) throw new Error('Profile insert failed: ' + profileErr?.message);
  const careProfileId = profile.id;

  // Medications
  const { data: insertedMeds } = await admin.from('medications').insert([
    { care_profile_id: careProfileId, name: 'Trastuzumab (Herceptin)', dose: '440mg', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'HER2-targeted therapy. Monitor cardiac function (echo every 3 months).' },
    { care_profile_id: careProfileId, name: 'Pertuzumab (Perjeta)', dose: '840mg', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'HER2-targeted therapy given with Herceptin.' },
    { care_profile_id: careProfileId, name: 'Docetaxel (Taxotere)', dose: '75mg/m²', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Taxane chemotherapy.' },
    { care_profile_id: careProfileId, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'As needed for nausea', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(3), quantity_remaining: 12 },
    { care_profile_id: careProfileId, name: 'Dexamethasone', dose: '4mg', frequency: 'Before chemo infusion', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), quantity_remaining: 6 },
    { care_profile_id: careProfileId, name: 'Tamoxifen', dose: '20mg', frequency: 'Once daily', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(25), quantity_remaining: 30, notes: 'Hormone therapy — long-term maintenance.' },
    { care_profile_id: careProfileId, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily — morning', prescribing_doctor: 'Dr. Maria Santos (Primary Care)', refill_date: dayISO(20), quantity_remaining: 24 },
    { care_profile_id: careProfileId, name: 'Lorazepam (Ativan)', dose: '0.5mg', frequency: 'As needed for anxiety', prescribing_doctor: 'Dr. Maria Santos (Primary Care)', refill_date: dayISO(30), quantity_remaining: 15 },
  ]).select('id, name');

  // Medication reminders + logs
  const dailyMeds = (insertedMeds || []).filter((m: { id: string; name: string }) =>
    m.name === 'Tamoxifen' || m.name === 'Lisinopril'
  );
  for (const med of dailyMeds) {
    const reminderTime = med.name === 'Lisinopril' ? '08:00' : '21:00';
    const { data: reminder } = await admin.from('medication_reminders').insert({
      user_id: userId, medication_id: med.id, medication_name: med.name,
      dose: med.name === 'Tamoxifen' ? '20mg' : '10mg',
      reminder_times: [reminderTime], days_of_week: ['mon','tue','wed','thu','fri','sat','sun'], is_active: true,
    }).select('id').single();
    if (!reminder) continue;
    const logs = [];
    for (let d = 7; d >= 1; d--) {
      const scheduled = day(-d); scheduled.setHours(parseInt(reminderTime), 0, 0, 0);
      const isMissed = d === 4 && med.name === 'Tamoxifen';
      logs.push({ user_id: userId, reminder_id: reminder.id, medication_name: med.name,
        scheduled_time: scheduled.toISOString(), status: isMissed ? 'missed' : 'taken',
        responded_at: isMissed ? null : new Date(scheduled.getTime() + 5*60000).toISOString() });
    }
    await admin.from('reminder_logs').insert(logs);
  }

  // Lab results
  await admin.from('lab_results').insert([
    { user_id: userId, test_name: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Hemoglobin', value: '11.2', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Platelet Count', value: '145', unit: 'K/uL', reference_range: '150-400', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Creatinine', value: '0.9', unit: 'mg/dL', reference_range: '0.6-1.2', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'HER2/neu', value: '15.8', unit: 'ng/mL', reference_range: '<15.0', is_abnormal: true, date_taken: day(-5).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'CA 15-3', value: '28.5', unit: 'U/mL', reference_range: '<30', is_abnormal: false, date_taken: day(-5).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'WBC (White Blood Cells)', value: '4.1', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-23).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Hemoglobin', value: '11.8', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-23).toISOString(), source: 'Demo' },
  ]);

  // Appointments
  await admin.from('appointments').insert([
    { care_profile_id: careProfileId, doctor_name: 'Dr. Lisa Chen', specialty: 'Medical Oncology', date_time: dayTime(3,10,0), location: 'Cancer Center — Clinic 2, Room 204', purpose: 'Oncology follow-up — treatment response review' },
    { care_profile_id: careProfileId, doctor_name: 'Lab Work', specialty: 'Laboratory', date_time: dayTime(6,8,0), location: 'Cancer Center — Lab', purpose: 'Pre-chemo bloodwork (CBC, CMP, tumor markers)' },
    { care_profile_id: careProfileId, doctor_name: 'Infusion Center', specialty: 'Medical Oncology', date_time: dayTime(7,9,0), location: 'Cancer Center — Infusion Suite B', purpose: 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere' },
    { care_profile_id: careProfileId, doctor_name: 'Dr. James Park', specialty: 'Cardiology', date_time: dayTime(14,11,0), location: 'Heart & Vascular Center', purpose: 'Echocardiogram — Herceptin cardiac monitoring' },
  ]);

  // Doctors
  await admin.from('doctors').insert([
    { care_profile_id: careProfileId, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Lead oncologist. Nurse line: 555-0211.' },
    { care_profile_id: careProfileId, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Monitoring cardiac function during Herceptin.' },
    { care_profile_id: careProfileId, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Managing BP, anxiety, general health.' },
    { care_profile_id: careProfileId, name: 'Sarah Johnson, RN', specialty: 'Oncology Nurse Navigator', phone: '555-0211', notes: 'First point of contact for treatment questions.' },
  ]);

  // Insurance
  await admin.from('insurance').upsert({ user_id: userId, provider: 'Blue Cross Blue Shield', member_id: 'BCB-882991-04', group_number: 'GRP-7420', plan_year: new Date().getFullYear() });

  // Notifications
  await admin.from('notifications').insert([
    { user_id: userId, type: 'lab_result', title: 'Low WBC — Neutropenia Warning', message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Contact oncology if temp > 100.4°F.', is_read: false },
    { user_id: userId, type: 'refill', title: 'Ondansetron (Zofran) refill soon', message: '12 tablets remaining. Refill due in 3 days.', is_read: false },
    { user_id: userId, type: 'appointment', title: 'Oncology follow-up in 3 days', message: 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM.', is_read: false },
    { user_id: userId, type: 'appointment', title: 'Chemo infusion in 1 week', message: 'Cycle 4 infusion on Thursday. Remember pre-meds night before.', is_read: false },
    { user_id: userId, type: 'lab_result', title: 'HER2/neu slightly elevated', message: 'HER2/neu is 15.8 ng/mL (normal: <15.0). Discuss trend with Dr. Chen.', is_read: true },
  ]);

  // Symptom journal
  const PATTERNS = [
    { pain_level: 3, mood: 'okay', energy: 'low', sleep_hours: 7, symptoms: ['Fatigue','Nausea'], notes: 'Rough morning, better by afternoon.' },
    { pain_level: 2, mood: 'good', energy: 'normal', sleep_hours: 7.5, symptoms: ['Mild fatigue'], notes: null },
    { pain_level: 4, mood: 'bad', energy: 'very_low', sleep_hours: 6, symptoms: ['Fatigue','Joint pain','Nausea'], notes: 'Nadir day 8 — feeling it today.' },
    { pain_level: 3, mood: 'okay', energy: 'low', sleep_hours: 7, symptoms: ['Fatigue','Mouth sores'], notes: 'Saltwater rinse helping.' },
    { pain_level: 2, mood: 'good', energy: 'normal', sleep_hours: 7.5, symptoms: ['Mild fatigue'], notes: null },
    { pain_level: 1, mood: 'good', energy: 'normal', sleep_hours: 8, symptoms: [], notes: 'Feeling stronger.' },
  ];
  await admin.from('symptom_entries').insert(
    PATTERNS.map((p, i) => ({ user_id: userId, care_profile_id: careProfileId, date: dayISO(-(6-i)), ...p }))
  );

  // User settings
  await admin.from('user_settings').upsert({ user_id: userId, refill_reminders: true, appointment_reminders: true, lab_alerts: true, claim_updates: true, ai_personality: 'friendly' });
}

main().catch((err) => { console.error(err); process.exit(1); });
