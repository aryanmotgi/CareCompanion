import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/fhir-providers';
import { syncOneUpData } from '@/lib/oneup-sync';
import { safeDecryptToken, encryptToken } from '@/lib/token-encryption';
import type { FhirBundle } from '@/lib/fhir';
import {
  parseMedications,
  parseConditions,
  parseAllergies,
  parseAppointments,
  parseLabResults,
  parseClaims,
  parseCoverage,
} from '@/lib/fhir';

export const maxDuration = 60;

async function fetchFhirBundle(
  fhirBaseUrl: string,
  resourceType: string,
  accessToken: string,
  params = ''
): Promise<FhirBundle> {
  const url = `${fhirBaseUrl}/${resourceType}${params ? `?${params}` : '?_count=100'}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
    },
  });

  if (!res.ok) {
    console.error(`FHIR fetch ${resourceType} failed:`, res.status, await res.text().catch(() => ''));
    return { resourceType: 'Bundle', entry: [] };
  }

  return res.json();
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider_id } = await req.json();
  if (!provider_id) {
    return Response.json({ error: 'provider_id required' }, { status: 400 });
  }

  const provider = getProvider(provider_id);
  if (!provider) {
    return Response.json({ error: `Unknown provider: ${provider_id}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1upHealth uses its own source name and dedicated sync engine
  const source = provider_id === '1uphealth' ? '1uphealth' : `fhir_${provider_id}`;

  // Get the stored connection
  const { data: connection } = await admin
    .from('connected_apps')
    .select('*')
    .eq('user_id', user.id)
    .eq('source', source)
    .single();

  if (!connection?.access_token) {
    return Response.json({ error: 'Not connected to this provider' }, { status: 400 });
  }

  // Decrypt stored token (handles legacy plaintext gracefully during migration)
  let accessToken = safeDecryptToken(connection.access_token);
  if (!accessToken) {
    return Response.json({ error: 'Token decryption failed — please reconnect' }, { status: 401 });
  }

  // Check if token is expired and refresh if needed
  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    const storedRefresh = safeDecryptToken(connection.refresh_token);
    if (!storedRefresh || !provider.supportsRefresh) {
      return Response.json({ error: 'Token expired, please reconnect' }, { status: 401 });
    }

    try {
      const clientId = process.env[provider.envClientId] || '';
      const clientSecret = process.env[provider.envClientSecret] || '';

      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: storedRefresh,
        client_id: clientId,
      });
      if (clientSecret) body.set('client_secret', clientSecret);

      const refreshRes = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!refreshRes.ok) {
        return Response.json({ error: 'Token refresh failed, please reconnect' }, { status: 401 });
      }

      const newTokens = await refreshRes.json();
      accessToken = newTokens.access_token;

      // Store refreshed tokens encrypted
      const newRefresh = newTokens.refresh_token
        ? encryptToken(newTokens.refresh_token)
        : connection.refresh_token; // Keep existing encrypted refresh token
      await admin.from('connected_apps').update({
        access_token: encryptToken(newTokens.access_token),
        refresh_token: newRefresh,
        expires_at: newTokens.expires_in
          ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
          : connection.expires_at,
      }).eq('id', connection.id);
    } catch (err) {
      console.error('Token refresh error:', err);
      return Response.json({ error: 'Token refresh failed' }, { status: 401 });
    }
  }

  // For 1upHealth, use the dedicated sync engine (it handles all resource types)
  if (provider_id === '1uphealth') {
    try {
      const results = await syncOneUpData(user.id, accessToken);
      return Response.json({ success: true, provider: provider.name, synced: results });
    } catch (err) {
      console.error('1upHealth sync error:', err);
      return Response.json({ error: 'Sync failed' }, { status: 500 });
    }
  }

  // Get or create care profile
  let { data: profile } = await admin
    .from('care_profiles')
    .select('id, conditions, allergies')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    const { data: newProfile } = await admin
      .from('care_profiles')
      .insert({ user_id: user.id })
      .select('id, conditions, allergies')
      .single();
    profile = newProfile;
  }

  if (!profile) {
    return Response.json({ error: 'Could not create care profile' }, { status: 500 });
  }

  const fhirBase = (connection.metadata as Record<string, string>)?.fhir_base_url || provider.fhirBaseUrl;

  const results = {
    medications: 0,
    conditions: 0,
    allergies: 0,
    appointments: 0,
    lab_results: 0,
    claims: 0,
    insurance: 0,
  };

  // Fetch all FHIR resources in parallel
  const [medBundle, condBundle, allergyBundle, apptBundle, labBundle, claimBundle, coverageBundle] =
    await Promise.all([
      fetchFhirBundle(fhirBase, 'MedicationRequest', accessToken, 'status=active&_count=100'),
      fetchFhirBundle(fhirBase, 'Condition', accessToken, 'clinical-status=active&_count=100'),
      fetchFhirBundle(fhirBase, 'AllergyIntolerance', accessToken, '_count=100'),
      fetchFhirBundle(fhirBase, 'Appointment', accessToken, `date=ge${new Date().toISOString().split('T')[0]}&_count=50`),
      fetchFhirBundle(fhirBase, 'Observation', accessToken, 'category=laboratory&_sort=-date&_count=50'),
      fetchFhirBundle(fhirBase, 'ExplanationOfBenefit', accessToken, '_sort=-created&_count=20').catch(() => ({ resourceType: 'Bundle' as const, entry: [] })),
      fetchFhirBundle(fhirBase, 'Coverage', accessToken, 'status=active&_count=10').catch(() => ({ resourceType: 'Bundle' as const, entry: [] })),
    ]);

  // Parse using existing FHIR parsers
  const medications = parseMedications(medBundle);
  const conditions = parseConditions(condBundle);
  const allergies = parseAllergies(allergyBundle);
  const appointments = parseAppointments(apptBundle);
  const labResults = parseLabResults(labBundle);
  const claims = parseClaims(claimBundle);
  const coverage = parseCoverage(coverageBundle);

  // Import medications (upsert by name)
  const syncSource = `Synced from ${provider.name}`;
  if (medications.length > 0) {
    await admin.from('medications').delete()
      .eq('care_profile_id', profile.id)
      .eq('notes', syncSource);

    await admin.from('medications').insert(
      medications.map((m) => ({
        care_profile_id: profile.id,
        name: m.name,
        dose: m.dose,
        frequency: m.frequency,
        notes: syncSource,
      }))
    );
    results.medications = medications.length;
  }

  // Update conditions
  if (conditions.length > 0) {
    const existing = profile.conditions || '';
    const newOnes = conditions.filter((c) => !existing.toLowerCase().includes(c.toLowerCase()));
    if (newOnes.length > 0) {
      const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
      await admin.from('care_profiles').update({ conditions: updated }).eq('id', profile.id);
      results.conditions = newOnes.length;
    }
  }

  // Update allergies
  if (allergies.length > 0) {
    const existing = profile.allergies || '';
    const newOnes = allergies.filter((a) => !existing.toLowerCase().includes(a.toLowerCase()));
    if (newOnes.length > 0) {
      const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
      await admin.from('care_profiles').update({ allergies: updated }).eq('id', profile.id);
      results.allergies = newOnes.length;
    }
  }

  // Import appointments (avoid duplicates)
  for (const appt of appointments) {
    if (appt.date_time) {
      const { data: existing } = await admin.from('appointments')
        .select('id')
        .eq('care_profile_id', profile.id)
        .eq('date_time', appt.date_time)
        .maybeSingle();
      if (!existing) {
        await admin.from('appointments').insert({
          care_profile_id: profile.id,
          doctor_name: appt.doctor_name,
          date_time: appt.date_time,
          purpose: appt.purpose,
        });
        results.appointments++;
      }
    }
  }

  // Import lab results
  if (labResults.length > 0) {
    await admin.from('lab_results').delete()
      .eq('user_id', user.id)
      .eq('source', provider_id);

    await admin.from('lab_results').insert(
      labResults.map((l) => ({
        user_id: user.id,
        ...l,
        source: provider_id,
      }))
    );
    results.lab_results = labResults.length;

    // Notify for abnormal results
    const abnormal = labResults.filter((l) => l.is_abnormal);
    for (const lab of abnormal) {
      await admin.from('notifications').insert({
        user_id: user.id,
        type: 'lab_result',
        title: `Abnormal lab result: ${lab.test_name}`,
        message: `${lab.test_name}: ${lab.value} ${lab.unit || ''} (range: ${lab.reference_range || 'N/A'}) — synced from ${provider.name}`,
      });
    }
  }

  // Import claims
  if (claims.length > 0) {
    for (const claim of claims) {
      await admin.from('claims').upsert({
        user_id: user.id,
        ...claim,
      });
    }
    results.claims = claims.length;
  }

  // Import coverage/insurance
  if (coverage.length > 0) {
    for (const cov of coverage) {
      await admin.from('insurance').upsert({
        user_id: user.id,
        provider: cov.provider,
        member_id: cov.member_id,
        group_number: cov.group_number,
        plan_year: new Date().getFullYear(),
      });
    }
    results.insurance = coverage.length;
  }

  // Update last_synced
  await admin.from('connected_apps')
    .update({ last_synced: new Date().toISOString() })
    .eq('id', connection.id);

  return Response.json({ success: true, provider: provider.name, synced: results });
}
