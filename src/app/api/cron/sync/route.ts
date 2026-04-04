import { createAdminClient } from '@/lib/supabase/admin';
import { syncOneUpData } from '@/lib/oneup-sync';
import { getProvider } from '@/lib/fhir-providers';
import type { FhirBundle } from '@/lib/fhir';
import {
  parseMedications,
  parseConditions,
  parseAllergies,
  parseAppointments,
  parseLabResults,
} from '@/lib/fhir';

export const maxDuration = 300; // 5 minutes max for cron

// Vercel cron calls this endpoint on schedule
// Configured in vercel.json: every 24 hours
export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get all connected apps that haven't synced in 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: connections } = await admin
    .from('connected_apps')
    .select('*')
    .or(`last_synced.is.null,last_synced.lt.${twentyFourHoursAgo}`);

  if (!connections || connections.length === 0) {
    return Response.json({ message: 'No connections need syncing', synced: 0 });
  }

  const results: { user_id: string; source: string; status: string; error?: string }[] = [];

  for (const conn of connections) {
    try {
      if (!conn.access_token) {
        results.push({ user_id: conn.user_id, source: conn.source, status: 'skipped', error: 'no token' });
        continue;
      }

      // Check if token is expired
      if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
        // Try to refresh
        const metadata = conn.metadata as Record<string, string> | null;
        const providerId = metadata?.provider_id;

        if (conn.refresh_token && providerId) {
          const provider = getProvider(providerId);
          if (provider?.supportsRefresh) {
            const clientId = process.env[provider.envClientId] || '';
            const clientSecret = process.env[provider.envClientSecret] || '';

            const body = new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: conn.refresh_token,
              client_id: clientId,
            });
            if (clientSecret) body.set('client_secret', clientSecret);

            const refreshRes = await fetch(provider.tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
            });

            if (refreshRes.ok) {
              const newTokens = await refreshRes.json();
              await admin.from('connected_apps').update({
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token || conn.refresh_token,
                expires_at: newTokens.expires_in
                  ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
                  : conn.expires_at,
              }).eq('id', conn.id);
              conn.access_token = newTokens.access_token;
            } else {
              results.push({ user_id: conn.user_id, source: conn.source, status: 'error', error: 'token refresh failed' });
              continue;
            }
          }
        } else {
          results.push({ user_id: conn.user_id, source: conn.source, status: 'expired', error: 'no refresh token' });
          continue;
        }
      }

      // Route to the right sync engine
      if (conn.source === '1uphealth') {
        await syncOneUpData(conn.user_id, conn.access_token);
        results.push({ user_id: conn.user_id, source: conn.source, status: 'success' });
      } else if (conn.source.startsWith('fhir_')) {
        // Generic FHIR sync
        const metadata = conn.metadata as Record<string, string> | null;
        const fhirBase = metadata?.fhir_base_url;
        if (!fhirBase) {
          results.push({ user_id: conn.user_id, source: conn.source, status: 'skipped', error: 'no fhir_base_url' });
          continue;
        }

        await syncFhirData(admin, conn.user_id, conn.access_token, fhirBase, conn.source);
        results.push({ user_id: conn.user_id, source: conn.source, status: 'success' });
      } else {
        results.push({ user_id: conn.user_id, source: conn.source, status: 'skipped', error: 'unknown source type' });
        continue;
      }

      // Update last_synced
      await admin.from('connected_apps')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', conn.id);

    } catch (err) {
      console.error(`Cron sync error for ${conn.source}/${conn.user_id}:`, err);
      results.push({
        user_id: conn.user_id,
        source: conn.source,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const successful = results.filter((r) => r.status === 'success').length;
  const failed = results.filter((r) => r.status === 'error').length;

  return Response.json({
    message: `Synced ${successful} connections, ${failed} failed`,
    total: connections.length,
    synced: successful,
    failed,
    results,
  });
}

// Lightweight FHIR sync for cron (reuses existing parsers)
async function syncFhirData(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  accessToken: string,
  fhirBase: string,
  source: string,
) {
  async function fetchBundle(resourceType: string, params = ''): Promise<FhirBundle> {
    const url = `${fhirBase}/${resourceType}${params ? `?${params}` : '?_count=100'}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/fhir+json' },
    });
    if (!res.ok) return { resourceType: 'Bundle', entry: [] };
    return res.json();
  }

  const { data: profile } = await admin
    .from('care_profiles')
    .select('id, conditions, allergies')
    .eq('user_id', userId)
    .single();

  if (!profile) return;

  const [medBundle, condBundle, allergyBundle, apptBundle, labBundle] = await Promise.all([
    fetchBundle('MedicationRequest', 'status=active&_count=100'),
    fetchBundle('Condition', 'clinical-status=active&_count=100'),
    fetchBundle('AllergyIntolerance', '_count=100'),
    fetchBundle('Appointment', `date=ge${new Date().toISOString().split('T')[0]}&_count=50`),
    fetchBundle('Observation', 'category=laboratory&_sort=-date&_count=50'),
  ]);

  const medications = parseMedications(medBundle);
  const conditions = parseConditions(condBundle);
  const allergies = parseAllergies(allergyBundle);
  const appointments = parseAppointments(apptBundle);
  const labResults = parseLabResults(labBundle);

  const providerId = source.replace('fhir_', '');
  const syncNote = `Synced from ${providerId}`;

  if (medications.length > 0) {
    await admin.from('medications').delete().eq('care_profile_id', profile.id).eq('notes', syncNote);
    await admin.from('medications').insert(
      medications.map((m) => ({ care_profile_id: profile.id, name: m.name, dose: m.dose, frequency: m.frequency, notes: syncNote }))
    );
  }

  if (conditions.length > 0) {
    const existing = profile.conditions || '';
    const newOnes = conditions.filter((c) => !existing.toLowerCase().includes(c.toLowerCase()));
    if (newOnes.length > 0) {
      await admin.from('care_profiles').update({ conditions: existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n') }).eq('id', profile.id);
    }
  }

  if (allergies.length > 0) {
    const existing = profile.allergies || '';
    const newOnes = allergies.filter((a) => !existing.toLowerCase().includes(a.toLowerCase()));
    if (newOnes.length > 0) {
      await admin.from('care_profiles').update({ allergies: existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n') }).eq('id', profile.id);
    }
  }

  for (const appt of appointments) {
    if (appt.date_time) {
      const { data: existing } = await admin.from('appointments').select('id').eq('care_profile_id', profile.id).eq('date_time', appt.date_time).maybeSingle();
      if (!existing) await admin.from('appointments').insert({ care_profile_id: profile.id, ...appt });
    }
  }

  if (labResults.length > 0) {
    await admin.from('lab_results').delete().eq('user_id', userId).eq('source', providerId);
    await admin.from('lab_results').insert(labResults.map((l) => ({ user_id: userId, ...l, source: providerId })));
  }
}
