import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
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

  // Seed medications
  await supabase.from('medications').insert([
    { care_profile_id: profile.id, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily - Morning', prescribing_doctor: 'Dr. Patel', refill_date: dayISO(1), quantity_remaining: 3, pharmacy_phone: '555-0100' },
    { care_profile_id: profile.id, name: 'Metformin', dose: '500mg', frequency: 'Twice daily - With meals', prescribing_doctor: 'Dr. Chen', refill_date: dayISO(18), quantity_remaining: 36 },
    { care_profile_id: profile.id, name: 'Atorvastatin', dose: '20mg', frequency: 'Once daily - Evening', prescribing_doctor: 'Dr. Patel', refill_date: dayISO(24), quantity_remaining: 24 },
    { care_profile_id: profile.id, name: 'Amlodipine', dose: '5mg', frequency: 'Once daily - Morning', prescribing_doctor: 'Dr. Patel', refill_date: dayISO(2), quantity_remaining: 5, pharmacy_phone: '555-0100' },
    { care_profile_id: profile.id, name: 'Vitamin D3', dose: '2000 IU', frequency: 'Once daily', prescribing_doctor: 'Dr. Chen', refill_date: dayISO(45), quantity_remaining: 60 },
  ]);

  // Seed appointments
  await supabase.from('appointments').insert([
    { care_profile_id: profile.id, doctor_name: 'Dr. Patel', specialty: 'Cardiology', date_time: dayTime(3, 14, 30), location: 'Heart & Vascular Center', purpose: 'BP medication follow-up' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Chen', specialty: 'Endocrinology', date_time: dayTime(2, 11, 0), location: 'Diabetes Care Clinic', purpose: 'A1C check and medication review' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Williams', specialty: 'Primary Care', date_time: dayTime(10, 10, 0), location: 'Valley Medical Group', purpose: 'Annual wellness visit' },
    { care_profile_id: profile.id, doctor_name: 'Dr. Kim', specialty: 'Ophthalmology', date_time: dayTime(21, 9, 15), location: 'Eye Care Associates', purpose: 'Diabetic eye exam' },
  ]);

  // Seed doctors
  await supabase.from('doctors').insert([
    { care_profile_id: profile.id, name: 'Dr. Patel', specialty: 'Cardiology', phone: '555-0101' },
    { care_profile_id: profile.id, name: 'Dr. Chen', specialty: 'Endocrinology', phone: '555-0102' },
    { care_profile_id: profile.id, name: 'Dr. Williams', specialty: 'Primary Care', phone: '555-0103' },
  ]);

  // Seed lab results
  await supabase.from('lab_results').insert([
    { user_id: user.id, test_name: 'LDL Cholesterol', value: '165', unit: 'mg/dL', reference_range: '< 100', is_abnormal: true, date_taken: day(-3).toISOString(), source: 'Quest Diagnostics' },
    { user_id: user.id, test_name: 'Hemoglobin A1C', value: '7.2', unit: '%', reference_range: '< 5.7', is_abnormal: true, date_taken: day(-5).toISOString(), source: 'Quest Diagnostics' },
    { user_id: user.id, test_name: 'Blood Pressure', value: '142/88', unit: 'mmHg', reference_range: '< 120/80', is_abnormal: true, date_taken: day(-1).toISOString(), source: 'Home Monitor' },
  ]);

  // Seed claims (one denied)
  await supabase.from('claims').insert([
    { user_id: user.id, service_date: day(-14).toISOString(), provider_name: 'Heart & Vascular Center', billed_amount: 450, paid_amount: 360, patient_responsibility: 90, status: 'paid' },
    { user_id: user.id, service_date: day(-7).toISOString(), provider_name: 'Quest Diagnostics', billed_amount: 285, paid_amount: 0, patient_responsibility: 285, status: 'denied', denial_reason: 'Prior authorization required' },
  ]);

  // Update care profile with emergency contact
  await supabase.from('care_profiles').update({
    emergency_contact_name: 'Jane Doe',
    emergency_contact_phone: '555-0199',
  }).eq('id', profile.id);

  // Upsert user settings
  await supabase.from('user_settings').upsert({
    user_id: user.id,
    refill_reminders: true,
    appointment_reminders: true,
    lab_alerts: true,
    claim_updates: true,
    ai_personality: 'professional',
  });

  // Seed notifications
  await supabase.from('notifications').insert([
    { user_id: user.id, type: 'refill', title: 'Lisinopril refill due tomorrow', message: 'Contact your pharmacy to refill.', is_read: false },
    { user_id: user.id, type: 'lab', title: 'New lab results available', message: 'Your cholesterol panel results are ready to review.', is_read: false },
  ]);

  return NextResponse.json({ success: true });
}
