/**
 * Start Demo Session
 *
 * Creates an anonymous demo account pre-loaded with realistic HER2+ Breast
 * Cancer care data, then signs the user in server-side. Used by the
 * /demo-walkthrough "Load Demo" button so anyone can instantly experience
 * the full app without signing up.
 *
 * Demo accounts have `user_metadata.is_demo = true` so the DemoBanner shows
 * across the app and a cleanup job can purge them later.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 10 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: rateOk } = limiter.check(ip);
  if (!rateOk) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
  }

  const admin = createAdminClient();
  const uuid = crypto.randomUUID();
  const shortId = uuid.slice(0, 8);
  const email = `demo-${uuid}@demo.carecompanionai.org`;
  const password = `Demo-${uuid}!`;

  // 1. Create the demo auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      is_demo: true,
      full_name: 'Demo User',
      display_name: 'Demo',
    },
  });

  if (createError || !newUser?.user) {
    console.error('[demo] Create user failed:', createError);
    return NextResponse.json({ error: 'Failed to create demo account' }, { status: 500 });
  }

  const userId = newUser.user.id;

  // 2. Seed the full cancer care dataset
  try {
    await seedDemoData(admin, userId);
  } catch (err) {
    console.error('[demo] Seed data failed:', err);
    // Clean up the user we just created
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }

  // 3. Sign the user in server-side (sets httpOnly cookies)
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    console.error('[demo] Sign in failed:', signInError);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: 'Failed to start demo session' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    redirect: '/dashboard?demo=started',
    shortId,
  });
}

// ═════════════════════════════════════════════════════════════════════════
// Seed function — creates a realistic HER2+ Breast Cancer care profile
// ═════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedDemoData(admin: any, userId: string) {
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

  // ── CARE PROFILE ──────────────────────────────────────────────
  const { data: profile, error: profileErr } = await admin
    .from('care_profiles')
    .insert({
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
      onboarding_priorities: ['Tracking side effects', 'Managing medications', 'Understanding lab results'],
      emergency_contact_name: 'Michael Mitchell (husband)',
      emergency_contact_phone: '555-0188',
    })
    .select('id')
    .single();

  if (profileErr || !profile) throw new Error('Profile insert failed: ' + profileErr?.message);
  const careProfileId = profile.id;

  // ── MEDICATIONS (8 — full chemo + supportive care regimen) ────
  await admin.from('medications').insert([
    {
      care_profile_id: careProfileId,
      name: 'Trastuzumab (Herceptin)',
      dose: '440mg',
      frequency: 'IV every 3 weeks',
      prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)',
      refill_date: dayISO(7),
      notes: 'HER2-targeted therapy. Monitor cardiac function (echo every 3 months).',
    },
    {
      care_profile_id: careProfileId,
      name: 'Pertuzumab (Perjeta)',
      dose: '840mg',
      frequency: 'IV every 3 weeks',
      prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)',
      refill_date: dayISO(7),
      notes: 'HER2-targeted therapy given with Herceptin. Watch for diarrhea.',
    },
    {
      care_profile_id: careProfileId,
      name: 'Docetaxel (Taxotere)',
      dose: '75mg/m²',
      frequency: 'IV every 3 weeks',
      prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)',
      refill_date: dayISO(7),
      notes: 'Taxane chemotherapy. Main side effects: neuropathy, hair loss, low blood counts.',
    },
    {
      care_profile_id: careProfileId,
      name: 'Ondansetron (Zofran)',
      dose: '8mg',
      frequency: 'As needed for nausea',
      prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)',
      refill_date: dayISO(3),
      quantity_remaining: 12,
      notes: 'Take at first sign of nausea. May cause constipation.',
    },
    {
      care_profile_id: careProfileId,
      name: 'Dexamethasone',
      dose: '4mg',
      frequency: 'Before chemo infusion',
      prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)',
      refill_date: dayISO(7),
      quantity_remaining: 6,
      notes: 'Pre-medication for chemo. Take night before and morning of infusion.',
    },
    {
      care_profile_id: careProfileId,
      name: 'Tamoxifen',
      dose: '20mg',
      frequency: 'Once daily',
      prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)',
      refill_date: dayISO(25),
      quantity_remaining: 30,
      notes: 'Hormone therapy. Long-term maintenance (5-10 years).',
    },
    {
      care_profile_id: careProfileId,
      name: 'Lisinopril',
      dose: '10mg',
      frequency: 'Once daily — morning',
      prescribing_doctor: 'Dr. Maria Santos (Primary Care)',
      refill_date: dayISO(20),
      quantity_remaining: 24,
      notes: 'Blood pressure control.',
    },
    {
      care_profile_id: careProfileId,
      name: 'Lorazepam (Ativan)',
      dose: '0.5mg',
      frequency: 'As needed for anxiety',
      prescribing_doctor: 'Dr. Maria Santos (Primary Care)',
      refill_date: dayISO(30),
      quantity_remaining: 15,
      notes: 'PRN for anxiety before scans or procedures. Do not mix with alcohol.',
    },
  ]);

  // ── LAB RESULTS (10 — realistic oncology panel with trends) ───
  await admin.from('lab_results').insert([
    // Most recent (2 days ago)
    { user_id: userId, test_name: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Hemoglobin', value: '11.2', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Platelet Count', value: '145', unit: 'K/uL', reference_range: '150-400', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Creatinine', value: '0.9', unit: 'mg/dL', reference_range: '0.6-1.2', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'ALT', value: '22', unit: 'U/L', reference_range: '7-56', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Demo' },
    // Tumor markers (5 days ago)
    { user_id: userId, test_name: 'HER2/neu', value: '15.8', unit: 'ng/mL', reference_range: '<15.0', is_abnormal: true, date_taken: day(-5).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'CA 15-3', value: '28.5', unit: 'U/mL', reference_range: '<30', is_abnormal: false, date_taken: day(-5).toISOString(), source: 'Demo' },
    // Previous cycle (23 days ago) for trend
    { user_id: userId, test_name: 'WBC (White Blood Cells)', value: '4.1', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-23).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Hemoglobin', value: '11.8', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-23).toISOString(), source: 'Demo' },
    { user_id: userId, test_name: 'Platelet Count', value: '168', unit: 'K/uL', reference_range: '150-400', is_abnormal: false, date_taken: day(-23).toISOString(), source: 'Demo' },
  ]);

  // ── APPOINTMENTS (5 — upcoming oncology schedule) ─────────────
  await admin.from('appointments').insert([
    {
      care_profile_id: careProfileId,
      doctor_name: 'Dr. Lisa Chen',
      specialty: 'Medical Oncology',
      date_time: dayTime(3, 10, 0),
      location: 'Cancer Center — Clinic 2, Room 204',
      purpose: 'Oncology follow-up — treatment response review',
    },
    {
      care_profile_id: careProfileId,
      doctor_name: 'Lab Work',
      specialty: 'Laboratory',
      date_time: dayTime(6, 8, 0),
      location: 'Cancer Center — Lab',
      purpose: 'Pre-chemo bloodwork (CBC, CMP, tumor markers)',
    },
    {
      care_profile_id: careProfileId,
      doctor_name: 'Infusion Center',
      specialty: 'Medical Oncology',
      date_time: dayTime(7, 9, 0),
      location: 'Cancer Center — Infusion Suite B',
      purpose: 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere',
    },
    {
      care_profile_id: careProfileId,
      doctor_name: 'Dr. James Park',
      specialty: 'Cardiology',
      date_time: dayTime(14, 11, 0),
      location: 'Heart & Vascular Center',
      purpose: 'Echocardiogram — Herceptin cardiac monitoring',
    },
    {
      care_profile_id: careProfileId,
      doctor_name: 'Dr. Rachel Kim',
      specialty: 'Breast Surgery',
      date_time: dayTime(28, 14, 30),
      location: 'Cancer Center — Surgery Clinic',
      purpose: 'Post-treatment surgical consult',
    },
  ]);

  // ── DOCTORS (5 — full care team) ──────────────────────────────
  await admin.from('doctors').insert([
    { care_profile_id: careProfileId, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Lead oncologist. Reachable via MyChart. Nurse line: 555-0211.' },
    { care_profile_id: careProfileId, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Monitoring cardiac function during Herceptin treatment.' },
    { care_profile_id: careProfileId, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Managing BP, anxiety, general health.' },
    { care_profile_id: careProfileId, name: 'Dr. Rachel Kim', specialty: 'Breast Surgeon', phone: '555-0204', notes: 'Surgical oncologist. Did initial lumpectomy.' },
    { care_profile_id: careProfileId, name: 'Sarah Johnson, RN', specialty: 'Oncology Nurse Navigator', phone: '555-0211', notes: 'First point of contact for treatment questions or side effects.' },
  ]);

  // ── INSURANCE ─────────────────────────────────────────────────
  await admin.from('insurance').upsert({
    user_id: userId,
    provider: 'Blue Cross Blue Shield',
    member_id: 'BCB-882991-04',
    group_number: 'GRP-7420',
    plan_year: new Date().getFullYear(),
  });

  // ── NOTIFICATIONS (5 — realistic alert mix) ───────────────────
  await admin.from('notifications').insert([
    {
      user_id: userId,
      type: 'lab_result',
      title: 'Low WBC — Neutropenia Warning',
      message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever or signs of infection. Contact oncology if temp > 100.4°F.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'refill',
      title: 'Ondansetron (Zofran) refill soon',
      message: '12 tablets remaining. Refill due in 3 days — you will need these for your next infusion.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'appointment',
      title: 'Oncology follow-up in 3 days',
      message: 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM. Review treatment response.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'appointment',
      title: 'Chemo infusion in 1 week',
      message: 'Cycle 4 infusion on Thursday. Remember pre-meds (Dexamethasone) night before and morning of.',
      is_read: false,
    },
    {
      user_id: userId,
      type: 'lab_result',
      title: 'HER2/neu slightly elevated',
      message: 'HER2/neu is 15.8 ng/mL (normal: <15.0). Discuss trend with Dr. Chen at your next visit.',
      is_read: true,
    },
  ]);

  // ── USER SETTINGS ─────────────────────────────────────────────
  await admin.from('user_settings').upsert({
    user_id: userId,
    refill_reminders: true,
    appointment_reminders: true,
    lab_alerts: true,
    claim_updates: true,
    ai_personality: 'friendly',
  });
}
