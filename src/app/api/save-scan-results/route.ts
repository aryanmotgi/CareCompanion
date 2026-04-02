import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const data = await req.json();

  // Get care profile
  const { data: profile } = await supabase
    .from('care_profiles')
    .select('id, conditions, allergies')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return Response.json({ error: 'No care profile found' }, { status: 400 });
  }

  const saved: Record<string, number> = {};

  // Save medications
  if (data.medications?.length > 0) {
    const rows = data.medications.map((med: Record<string, string>) => ({
      care_profile_id: profile.id,
      name: med.name,
      dose: med.dose || null,
      frequency: med.frequency || null,
      prescribing_doctor: med.prescribing_doctor || null,
      refill_date: med.refill_date || null,
      notes: `Imported via photo scan`,
    }));
    const { error } = await supabase.from('medications').insert(rows);
    if (!error) saved.medications = rows.length;
  }

  // Save lab results
  if (data.lab_results?.length > 0) {
    const rows = data.lab_results.map((lab: Record<string, string | boolean>) => ({
      user_id: user.id,
      test_name: lab.test_name,
      value: lab.value || null,
      unit: lab.unit || null,
      reference_range: lab.reference_range || null,
      is_abnormal: lab.is_abnormal || false,
      date_taken: data.date_taken || null,
      source: 'photo_scan',
    }));
    const { error } = await supabase.from('lab_results').insert(rows);
    if (!error) saved.lab_results = rows.length;
  }

  // Save insurance
  if (data.insurance) {
    const ins = data.insurance;
    const { error } = await supabase.from('insurance').upsert(
      {
        user_id: user.id,
        provider: ins.provider || 'Unknown',
        member_id: ins.member_id || null,
        group_number: ins.group_number || null,
        plan_year: new Date().getFullYear(),
      },
      { onConflict: 'id' }
    );
    if (!error) saved.insurance = 1;
  }

  // Save conditions (append to existing)
  if (data.conditions?.length > 0) {
    const existing = profile.conditions || '';
    const newConditions = data.conditions.filter((c: string) => !existing.toLowerCase().includes(c.toLowerCase()));
    if (newConditions.length > 0) {
      const updated = existing
        ? `${existing}\n${newConditions.join('\n')}`
        : newConditions.join('\n');
      await supabase.from('care_profiles').update({ conditions: updated }).eq('id', profile.id);
      saved.conditions = newConditions.length;
    }
  }

  // Save appointments
  if (data.appointments?.length > 0) {
    const rows = data.appointments.map((appt: Record<string, string>) => ({
      care_profile_id: profile.id,
      doctor_name: appt.doctor_name || null,
      date_time: appt.date_time || null,
      purpose: appt.purpose || null,
    }));
    const { error } = await supabase.from('appointments').insert(rows);
    if (!error) saved.appointments = rows.length;
  }

  // Save claims
  if (data.claims?.length > 0) {
    const rows = data.claims.map((claim: Record<string, string | number>) => ({
      user_id: user.id,
      service_date: claim.service_date || null,
      provider_name: claim.provider_name || null,
      billed_amount: claim.billed_amount || null,
      paid_amount: claim.paid_amount || null,
      patient_responsibility: claim.patient_responsibility || null,
      status: claim.status || 'pending',
    }));
    const { error } = await supabase.from('claims').insert(rows);
    if (!error) saved.claims = rows.length;
  }

  return Response.json({ success: true, saved });
}
