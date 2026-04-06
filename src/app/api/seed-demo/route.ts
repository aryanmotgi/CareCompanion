import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 400 });

  const now = new Date();
  const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
  const dayISO = (d: number) => day(d).toISOString().split('T')[0];
  const dayTime = (d: number, h: number, m: number) => { const x = day(d); x.setHours(h, m, 0, 0); return x.toISOString(); };

  // Update care profile with cancer-specific info
  await supabase.from('care_profiles').update({
    patient_name: 'Mom',
    patient_age: 62,
    relationship: 'parent',
    conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nAnxiety',
    allergies: 'Sulfa drugs\nLatex',
    emergency_contact_name: 'Dad (Robert)',
    emergency_contact_phone: '555-0199',
  }).eq('id', profile.id);

  // Seed cancer medications
  await supabase.from('medications').insert([
    { care_profile_id: profile.id, name: 'Paclitaxel (Taxol)', dose: '175 mg/m²', frequency: 'Every 3 weeks — IV infusion', prescribing_doctor: 'Dr. Rivera (Oncology)', refill_date: dayISO(7), quantity_remaining: null, notes: 'Cycle 4 of 6 — AC-T regimen' },
    { care_profile_id: profile.id, name: 'Trastuzumab (Herceptin)', dose: '6 mg/kg', frequency: 'Every 3 weeks — IV infusion', prescribing_doctor: 'Dr. Rivera (Oncology)', refill_date: dayISO(7), quantity_remaining: null, notes: 'HER2-targeted therapy, continues for 1 year' },
    { care_profile_id: profile.id, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'Every 8 hours as needed', prescribing_doctor: 'Dr. Rivera (Oncology)', refill_date: dayISO(3), quantity_remaining: 6, pharmacy_phone: '555-0100', notes: 'Anti-nausea — take 30 min before chemo' },
    { care_profile_id: profile.id, name: 'Dexamethasone', dose: '4mg', frequency: 'Twice daily — days 1-3 of each cycle', prescribing_doctor: 'Dr. Rivera (Oncology)', refill_date: dayISO(14), quantity_remaining: 18, notes: 'Steroid to prevent chemo reactions' },
    { care_profile_id: profile.id, name: 'Filgrastim (Neupogen)', dose: '5 mcg/kg', frequency: 'Daily — days 3-10 of each cycle', prescribing_doctor: 'Dr. Rivera (Oncology)', refill_date: dayISO(5), quantity_remaining: 4, pharmacy_phone: '555-0100', notes: 'White blood cell booster — subcutaneous injection' },
    { care_profile_id: profile.id, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily — Morning', prescribing_doctor: 'Dr. Patel (Cardiology)', refill_date: dayISO(20), quantity_remaining: 24, notes: 'Blood pressure — monitor for interactions with chemo' },
    { care_profile_id: profile.id, name: 'Lorazepam (Ativan)', dose: '0.5mg', frequency: 'As needed for anxiety', prescribing_doctor: 'Dr. Kim (Psychiatry)', refill_date: dayISO(30), quantity_remaining: 15, notes: 'PRN — max 2x daily, helpful before infusions' },
  ]);

  // Seed oncology appointments
  await supabase.from('appointments').insert([
    { care_profile_id: profile.id, doctor_name: 'Dr. Rivera', specialty: 'Medical Oncology', date_time: dayTime(3, 9, 0), location: 'Cancer Center — Infusion Suite B', purpose: 'Cycle 4 Paclitaxel + Herceptin infusion' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Rivera', specialty: 'Medical Oncology', date_time: dayTime(1, 14, 0), location: 'Cancer Center — Clinic 3', purpose: 'Pre-chemo bloodwork and oncology check-in' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Patel', specialty: 'Cardiology', date_time: dayTime(10, 11, 0), location: 'Heart & Vascular Center', purpose: 'Echocardiogram — Herceptin cardiac monitoring' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Lee', specialty: 'Radiation Oncology', date_time: dayTime(21, 10, 30), location: 'Cancer Center — Radiation', purpose: 'Radiation planning consultation (post-chemo)' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Kim', specialty: 'Psychiatry', date_time: dayTime(14, 15, 0), location: 'Telehealth', purpose: 'Anxiety management follow-up' },
  ]);

  // Seed oncology team
  await supabase.from('doctors').insert([
    { care_profile_id: profile.id, name: 'Dr. Rivera', specialty: 'Medical Oncology', phone: '555-0201', notes: 'Primary oncologist — AC-T + Herceptin regimen' },
    { care_profile_id: profile.id, name: 'Dr. Lee', specialty: 'Radiation Oncology', phone: '555-0202', notes: 'Will begin radiation after chemo completes' },
    { care_profile_id: profile.id, name: 'Dr. Patel', specialty: 'Cardiology', phone: '555-0203', notes: 'Cardiac monitoring during Herceptin — echo every 3 months' },
    { care_profile_id: profile.id, name: 'Dr. Kim', specialty: 'Psychiatry', phone: '555-0204', notes: 'Anxiety and treatment-related distress' },
    { care_profile_id: profile.id, name: 'Sarah, RN', specialty: 'Oncology Nurse Navigator', phone: '555-0205', notes: 'Go-to for scheduling, side effect questions, insurance pre-auths' },
  ]);

  // Seed cancer-relevant lab results
  await supabase.from('lab_results').insert([
    // CBC — critical during chemo
    { user_id: user.id, test_name: 'WBC (White Blood Cells)', value: '2.8', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Cancer Center Lab' },
    { user_id: user.id, test_name: 'ANC (Absolute Neutrophil Count)', value: '1.2', unit: 'K/uL', reference_range: '1.5-8.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Cancer Center Lab' },
    { user_id: user.id, test_name: 'Hemoglobin', value: '10.8', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Cancer Center Lab' },
    { user_id: user.id, test_name: 'Platelets', value: '145', unit: 'K/uL', reference_range: '150-400', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Cancer Center Lab' },
    // Tumor markers
    { user_id: user.id, test_name: 'CA 15-3', value: '38', unit: 'U/mL', reference_range: '< 30', is_abnormal: true, date_taken: day(-5).toISOString(), source: 'Cancer Center Lab' },
    { user_id: user.id, test_name: 'CEA', value: '4.2', unit: 'ng/mL', reference_range: '< 5.0', is_abnormal: false, date_taken: day(-5).toISOString(), source: 'Cancer Center Lab' },
    // Kidney/liver function
    { user_id: user.id, test_name: 'Creatinine', value: '0.9', unit: 'mg/dL', reference_range: '0.6-1.2', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Cancer Center Lab' },
    { user_id: user.id, test_name: 'ALT', value: '42', unit: 'U/L', reference_range: '7-56', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Cancer Center Lab' },
    // Cardiac marker for Herceptin monitoring
    { user_id: user.id, test_name: 'LVEF (Ejection Fraction)', value: '58', unit: '%', reference_range: '> 50', is_abnormal: false, date_taken: day(-14).toISOString(), source: 'Cardiology — Echo' },
  ]);

  // Seed insurance claims
  await supabase.from('claims').insert([
    { user_id: user.id, service_date: day(-21).toISOString(), provider_name: 'Cancer Center — Infusion', billed_amount: 12500, paid_amount: 11250, patient_responsibility: 1250, status: 'paid' },
    { user_id: user.id, service_date: day(-7).toISOString(), provider_name: 'Cancer Center Lab', billed_amount: 850, paid_amount: 680, patient_responsibility: 170, status: 'paid' },
    { user_id: user.id, service_date: day(-14).toISOString(), provider_name: 'Cardiology — Echo', billed_amount: 1800, paid_amount: 0, patient_responsibility: 1800, status: 'denied', denial_reason: 'Prior authorization required for cardiac monitoring' },
  ]);

  // Seed symptom journal entries
  await supabase.from('symptom_entries').insert([
    { user_id: user.id, care_profile_id: profile.id, date: dayISO(-1), pain_level: 3, mood: 'okay', sleep_quality: 'fair', sleep_hours: 5.5, appetite: 'decreased', energy: 'low', symptoms: ['Nausea', 'Fatigue', 'Neuropathy'], notes: 'Nausea: 6/10 | Fatigue: 7/10 | Tingling in fingertips getting worse' },
    { user_id: user.id, care_profile_id: profile.id, date: dayISO(-2), pain_level: 4, mood: 'bad', sleep_quality: 'poor', sleep_hours: 4, appetite: 'none', energy: 'very_low', symptoms: ['Nausea', 'Vomiting', 'Fatigue', 'Mouth sores'], notes: 'Nausea: 8/10 | Fatigue: 9/10 | Worst day of this cycle — couldn\'t keep food down' },
    { user_id: user.id, care_profile_id: profile.id, date: dayISO(-3), pain_level: 2, mood: 'good', sleep_quality: 'good', sleep_hours: 7, appetite: 'normal', energy: 'normal', symptoms: ['Fatigue'], notes: 'Fatigue: 4/10 | Good day — appetite came back, walked 20 min' },
  ]);

  // Upsert user settings
  await supabase.from('user_settings').upsert({
    user_id: user.id,
    refill_reminders: true,
    appointment_reminders: true,
    lab_alerts: true,
    claim_updates: true,
    ai_personality: 'friendly',
  });

  // Seed notifications
  await supabase.from('notifications').insert([
    { user_id: user.id, type: 'lab_result', title: 'Low WBC — Neutropenia Warning', message: 'WBC is 2.8 K/uL (normal: 4.5-11.0). ANC is 1.2 — watch for fever or signs of infection. Contact oncology if temp > 100.4°F.', is_read: false },
    { user_id: user.id, type: 'refill', title: 'Ondansetron (Zofran) running low', message: '6 tablets remaining. Refill due in 3 days — you\'ll need these for next infusion.', is_read: false },
    { user_id: user.id, type: 'appointment', title: 'Pre-chemo bloodwork tomorrow', message: 'Blood draw at Cancer Center — Clinic 3, 2:00 PM. Results needed before Cycle 4 infusion.', is_read: false },
    { user_id: user.id, type: 'claim', title: 'Echo claim denied — needs prior auth', message: 'Cardiology echo ($1,800) denied. Sarah (nurse navigator) can help submit the prior authorization.', is_read: false },
  ]);

  return NextResponse.json({ success: true });
}
