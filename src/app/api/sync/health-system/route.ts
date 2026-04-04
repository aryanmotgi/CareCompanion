import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseMedications,
  parseConditions,
  parseAllergies,
  parseAppointments,
  parseLabResults,
  type FhirBundle,
} from '@/lib/fhir';

async function fetchFhirBundle(accessToken: string, resourceType: string): Promise<FhirBundle> {
  const res = await fetch(
    `https://api.1up.health/fhir/r4/${resourceType}?_count=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return { resourceType: 'Bundle', entry: [] };
  return res.json();
}

export async function POST(req: Request) {
  // Auth check — verify requesting user matches the user_id
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { user_id } = await req.json();
  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  if (user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: connection } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user_id)
    .eq('source', 'health_system')
    .single();

  if (!connection?.access_token) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  const { data: profile } = await admin
    .from('care_profiles')
    .select('id, conditions, allergies')
    .eq('user_id', user_id)
    .single();

  if (!profile) {
    return Response.json({ error: 'No care profile' }, { status: 400 });
  }

  const token = connection.access_token;

  // Fetch all FHIR resources in parallel
  const [medBundle, condBundle, allergyBundle, apptBundle, labBundle] = await Promise.all([
    fetchFhirBundle(token, 'MedicationRequest'),
    fetchFhirBundle(token, 'Condition'),
    fetchFhirBundle(token, 'AllergyIntolerance'),
    fetchFhirBundle(token, 'Appointment'),
    fetchFhirBundle(token, 'Observation'),
  ]);

  const medications = parseMedications(medBundle);
  const conditions = parseConditions(condBundle);
  const allergies = parseAllergies(allergyBundle);
  const appointments = parseAppointments(apptBundle);
  const labResults = parseLabResults(labBundle);

  // Import medications
  for (const med of medications) {
    const { data: existing } = await admin
      .from('medications')
      .select('id')
      .eq('care_profile_id', profile.id)
      .eq('name', med.name)
      .limit(1);

    if (!existing || existing.length === 0) {
      await admin.from('medications').insert({
        care_profile_id: profile.id,
        name: med.name,
        dose: med.dose,
        frequency: med.frequency,
        notes: 'Imported from health system via FHIR',
      });
    }
  }

  // Update conditions and allergies on profile
  if (conditions.length > 0) {
    const existingConditions = profile.conditions || '';
    const newConditions = conditions.filter((c) => !existingConditions.includes(c));
    if (newConditions.length > 0) {
      const updated = existingConditions
        ? `${existingConditions}\n${newConditions.join('\n')}`
        : newConditions.join('\n');
      await admin.from('care_profiles').update({ conditions: updated }).eq('id', profile.id);
    }
  }

  if (allergies.length > 0) {
    const existingAllergies = profile.allergies || '';
    const newAllergies = allergies.filter((a) => !existingAllergies.includes(a));
    if (newAllergies.length > 0) {
      const updated = existingAllergies
        ? `${existingAllergies}\n${newAllergies.join('\n')}`
        : newAllergies.join('\n');
      await admin.from('care_profiles').update({ allergies: updated }).eq('id', profile.id);
    }
  }

  // Import appointments
  for (const appt of appointments) {
    await admin.from('appointments').insert({
      care_profile_id: profile.id,
      doctor_name: appt.doctor_name,
      date_time: appt.date_time,
      purpose: appt.purpose,
    });
  }

  // Import lab results
  for (const lab of labResults) {
    const { data: existing } = await admin
      .from('lab_results')
      .select('id')
      .eq('user_id', user_id)
      .eq('test_name', lab.test_name)
      .eq('date_taken', lab.date_taken || '')
      .limit(1);

    if (!existing || existing.length === 0) {
      await admin.from('lab_results').insert({
        user_id,
        ...lab,
        source: 'health_system',
      });

      // Create notification for abnormal results
      if (lab.is_abnormal) {
        await admin.from('notifications').insert({
          user_id,
          type: 'lab_result',
          title: `Abnormal lab result: ${lab.test_name}`,
          message: `${lab.test_name}: ${lab.value} ${lab.unit || ''} (range: ${lab.reference_range || 'N/A'})`,
        });
      }
    }
  }

  await admin
    .from('connected_apps')
    .update({ last_synced: new Date().toISOString() })
    .eq('id', connection.id);

  return Response.json({
    success: true,
    imported: {
      medications: medications.length,
      conditions: conditions.length,
      allergies: allergies.length,
      appointments: appointments.length,
      labResults: labResults.length,
    },
  });
}
