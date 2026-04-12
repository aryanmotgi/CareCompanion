import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) return ApiErrors.rateLimited();

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('care_profiles')
      .select('id, patient_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) return apiError('No profile', 400);

    const now = new Date();
    const day = (d: number) => { const x = new Date(now); x.setDate(x.getDate() + d); return x; };
    const dayISO = (d: number) => day(d).toISOString().split('T')[0];
    const dayTime = (d: number, h: number, m: number) => { const x = day(d); x.setHours(h, m, 0, 0); return x.toISOString(); };

    // Clear previous demo data
    await Promise.all([
      admin.from('medications').delete().eq('care_profile_id', profile.id).eq('notes', 'Demo data'),
      admin.from('appointments').delete().eq('care_profile_id', profile.id).eq('notes', 'Demo data'),
      admin.from('doctors').delete().eq('care_profile_id', profile.id).eq('notes', 'Demo data'),
      admin.from('lab_results').delete().eq('user_id', user.id).eq('source', 'Demo data'),
    ]);

    // Update care profile with cancer-specific info
    await admin.from('care_profiles').update({
      patient_name: profile.patient_name || 'Sarah Mitchell',
      patient_age: 58,
      cancer_type: 'HER2+ Breast Cancer',
      cancer_stage: 'Stage IIIA',
      treatment_phase: 'active_treatment',
      conditions: 'Stage IIIA Breast Cancer (HER2+, ER+)\nHypertension\nOsteoporosis\nAnxiety',
      allergies: 'Sulfa drugs\nLatex\nIbuprofen (causes GI upset)',
      onboarding_completed: true,
    }).eq('id', profile.id);

    // Medications (8)
    const { data: meds } = await admin.from('medications').insert([
      { care_profile_id: profile.id, name: 'Trastuzumab (Herceptin)', dose: '440mg', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Pertuzumab (Perjeta)', dose: '840mg', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Docetaxel (Taxotere)', dose: '75mg/m²', frequency: 'IV every 3 weeks', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Ondansetron (Zofran)', dose: '8mg', frequency: 'As needed for nausea', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(3), quantity_remaining: 12, notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Dexamethasone', dose: '4mg', frequency: 'Before chemo infusion', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(7), quantity_remaining: 6, notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Tamoxifen', dose: '20mg', frequency: 'Once daily', prescribing_doctor: 'Dr. Lisa Chen (Medical Oncology)', refill_date: dayISO(25), quantity_remaining: 30, notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Lisinopril', dose: '10mg', frequency: 'Once daily — morning', prescribing_doctor: 'Dr. Maria Santos (Primary Care)', refill_date: dayISO(20), quantity_remaining: 24, notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Lorazepam (Ativan)', dose: '0.5mg', frequency: 'As needed for anxiety', prescribing_doctor: 'Dr. Maria Santos (Primary Care)', refill_date: dayISO(30), quantity_remaining: 15, notes: 'Demo data' },
    ]).select('id');

    // Lab results (7)
    const { data: labs } = await admin.from('lab_results').insert([
      { user_id: user.id, test_name: 'WBC (White Blood Cells)', value: '3.2', unit: 'K/uL', reference_range: '4.5-11.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo data' },
      { user_id: user.id, test_name: 'HER2/neu', value: '15.8', unit: 'ng/mL', reference_range: '<15.0', is_abnormal: true, date_taken: day(-5).toISOString(), source: 'Demo data' },
      { user_id: user.id, test_name: 'CA 15-3', value: '28.5', unit: 'U/mL', reference_range: '<30', is_abnormal: false, date_taken: day(-5).toISOString(), source: 'Demo data' },
      { user_id: user.id, test_name: 'Hemoglobin', value: '11.2', unit: 'g/dL', reference_range: '12.0-16.0', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo data' },
      { user_id: user.id, test_name: 'Platelet Count', value: '145', unit: 'K/uL', reference_range: '150-400', is_abnormal: true, date_taken: day(-2).toISOString(), source: 'Demo data' },
      { user_id: user.id, test_name: 'Creatinine', value: '0.9', unit: 'mg/dL', reference_range: '0.6-1.2', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Demo data' },
      { user_id: user.id, test_name: 'ALT', value: '22', unit: 'U/L', reference_range: '7-56', is_abnormal: false, date_taken: day(-2).toISOString(), source: 'Demo data' },
    ]).select('id');

    // Appointments (4 future)
    const { data: appts } = await admin.from('appointments').insert([
      { care_profile_id: profile.id, doctor_name: 'Dr. Lisa Chen', specialty: 'Medical Oncology', date_time: dayTime(3, 10, 0), location: 'Cancer Center — Clinic 2', purpose: 'Oncology follow-up — treatment response review', notes: 'Demo data' },
      { care_profile_id: profile.id, doctor_name: 'Lab Work', specialty: 'Laboratory', date_time: dayTime(6, 8, 0), location: 'Cancer Center — Lab', purpose: 'Pre-chemo bloodwork (CBC, CMP, tumor markers)', notes: 'Demo data' },
      { care_profile_id: profile.id, doctor_name: 'Infusion Center', specialty: 'Medical Oncology', date_time: dayTime(7, 9, 0), location: 'Cancer Center — Infusion Suite B', purpose: 'Chemotherapy infusion — Herceptin + Perjeta + Taxotere', notes: 'Demo data' },
      { care_profile_id: profile.id, doctor_name: 'Dr. James Park', specialty: 'Cardiology', date_time: dayTime(14, 11, 0), location: 'Heart & Vascular Center', purpose: 'Echocardiogram — Herceptin cardiac monitoring', notes: 'Demo data' },
    ]).select('id');

    // Doctors (4)
    const { data: docs } = await admin.from('doctors').insert([
      { care_profile_id: profile.id, name: 'Dr. Lisa Chen', specialty: 'Medical Oncologist', phone: '555-0201', notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Dr. James Park', specialty: 'Cardiologist', phone: '555-0202', notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Dr. Maria Santos', specialty: 'Primary Care', phone: '555-0203', notes: 'Demo data' },
      { care_profile_id: profile.id, name: 'Dr. Rachel Kim', specialty: 'Breast Surgeon', phone: '555-0204', notes: 'Demo data' },
    ]).select('id');

    // Insurance
    await admin.from('insurance').upsert({
      user_id: user.id,
      provider: 'Blue Cross Blue Shield',
      member_id: 'BCB-882991-04',
      group_number: 'GRP-7420',
    });

    // Mark 1upHealth as connected so profile shows "Connected"
    await admin.from('connected_apps').upsert(
      {
        user_id: user.id,
        source: '1uphealth',
        access_token: 'demo-token',
        last_synced: new Date().toISOString(),
        metadata: { provider_name: '1upHealth', provider_id: '1uphealth', demo: true },
      },
      { onConflict: 'user_id,source' }
    );

    // Upsert user settings
    await admin.from('user_settings').upsert({
      user_id: user.id,
      refill_reminders: true,
      appointment_reminders: true,
      lab_alerts: true,
      claim_updates: true,
      ai_personality: 'friendly',
    });

    // Seed notifications
    await admin.from('notifications').insert([
      { user_id: user.id, type: 'lab_result', title: 'Low WBC — Neutropenia Warning', message: 'WBC is 3.2 K/uL (normal: 4.5-11.0). Watch for fever or signs of infection. Contact oncology if temp > 100.4 F.', is_read: false },
      { user_id: user.id, type: 'refill', title: 'Ondansetron (Zofran) refill soon', message: '12 tablets remaining. Refill due in 3 days — you will need these for your next infusion.', is_read: false },
      { user_id: user.id, type: 'appointment', title: 'Oncology follow-up in 3 days', message: 'Dr. Lisa Chen at Cancer Center — Clinic 2, 10:00 AM. Review treatment response.', is_read: false },
    ]);

    return apiSuccess({
      counts: {
        medications: meds?.length ?? 0,
        labs: labs?.length ?? 0,
        appointments: appts?.length ?? 0,
        doctors: docs?.length ?? 0,
      },
    });
  } catch (err) {
    console.error('[seed-demo] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
