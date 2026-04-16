import { db } from '@/lib/db';
import { connectedApps, careProfiles, medications as medsTable, labResults as labResultsTable, appointments as apptsTable } from '@/lib/db/schema';
import { eq, isNull, lt, or } from 'drizzle-orm';
import { syncOneUpData } from '@/lib/oneup-sync';
import { getProvider } from '@/lib/fhir-providers';
import { safeDecryptToken, encryptToken } from '@/lib/token-encryption';
import type { FhirBundle } from '@/lib/fhir';
import {
  parseMedications,
  parseConditions,
  parseAllergies,
  parseAppointments,
  parseLabResults,
} from '@/lib/fhir';
import { withMetrics } from '@/lib/api-metrics';

export const maxDuration = 300; // 5 minutes max for cron

// Vercel cron calls this endpoint on schedule
// Configured in vercel.json: every 24 hours
async function handler(req: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const connections = await db
    .select()
    .from(connectedApps)
    .where(or(isNull(connectedApps.lastSynced), lt(connectedApps.lastSynced, twentyFourHoursAgo)));

  if (connections.length === 0) {
    return Response.json({ message: 'No connections need syncing', synced: 0 });
  }

  const results: { user_id: string; source: string; status: string; error?: string }[] = [];

  for (const conn of connections) {
    try {
      if (!conn.accessToken) {
        results.push({ user_id: conn.userId, source: conn.source, status: 'skipped', error: 'no token' });
        continue;
      }

      const decryptedToken = safeDecryptToken(conn.accessToken);
      if (!decryptedToken) {
        results.push({ user_id: conn.userId, source: conn.source, status: 'skipped', error: 'token decrypt failed' });
        continue;
      }
      let accessToken: string = decryptedToken;

      // Check if token is expired
      if (conn.expiresAt && new Date(conn.expiresAt) < new Date()) {
        const metadata = conn.metadata as Record<string, string> | null;
        const providerId = metadata?.provider_id;
        const storedRefresh = safeDecryptToken(conn.refreshToken || '');

        if (storedRefresh && providerId) {
          const provider = getProvider(providerId);
          if (provider?.supportsRefresh) {
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

            if (refreshRes.ok) {
              const newTokens = await refreshRes.json();
              const newRefresh = newTokens.refresh_token
                ? encryptToken(newTokens.refresh_token)
                : conn.refreshToken;
              await db.update(connectedApps).set({
                accessToken: encryptToken(newTokens.access_token),
                refreshToken: newRefresh,
                expiresAt: newTokens.expires_in
                  ? new Date(Date.now() + newTokens.expires_in * 1000)
                  : conn.expiresAt,
              }).where(eq(connectedApps.id, conn.id));
              accessToken = newTokens.access_token;
            } else {
              results.push({ user_id: conn.userId, source: conn.source, status: 'error', error: 'token refresh failed' });
              continue;
            }
          }
        } else {
          results.push({ user_id: conn.userId, source: conn.source, status: 'expired', error: 'no refresh token' });
          continue;
        }
      }

      // Route to the right sync engine
      if (conn.source === '1uphealth') {
        await syncOneUpData(conn.userId, accessToken);
        results.push({ user_id: conn.userId, source: conn.source, status: 'success' });
      } else if (conn.source.startsWith('fhir_')) {
        const metadata = conn.metadata as Record<string, string> | null;
        const fhirBase = metadata?.fhir_base_url;
        if (!fhirBase) {
          results.push({ user_id: conn.userId, source: conn.source, status: 'skipped', error: 'no fhir_base_url' });
          continue;
        }

        await syncFhirData(conn.userId, accessToken, fhirBase, conn.source);
        results.push({ user_id: conn.userId, source: conn.source, status: 'success' });
      } else {
        results.push({ user_id: conn.userId, source: conn.source, status: 'skipped', error: 'unknown source type' });
        continue;
      }

      await db.update(connectedApps).set({ lastSynced: new Date() }).where(eq(connectedApps.id, conn.id));

    } catch (err) {
      console.error(`Cron sync error for ${conn.source}/${conn.userId}:`, err);
      results.push({
        user_id: conn.userId,
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

export const GET = withMetrics('/api/cron/sync', handler);

// Lightweight FHIR sync for cron (reuses existing parsers)
async function syncFhirData(
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

  const [profile] = await db
    .select({ id: careProfiles.id, conditions: careProfiles.conditions, allergies: careProfiles.allergies })
    .from(careProfiles)
    .where(eq(careProfiles.userId, userId))
    .limit(1);

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
  const labs = parseLabResults(labBundle);

  const providerId = source.replace('fhir_', '');
  const syncNote = `Synced from ${providerId}`;

  if (medications.length > 0) {
    await db.delete(medsTable).where(eq(medsTable.careProfileId, profile.id));
    await db.insert(medsTable).values(
      medications.map((m) => ({ careProfileId: profile.id, name: m.name, dose: m.dose, frequency: m.frequency, notes: syncNote }))
    );
  }

  if (conditions.length > 0) {
    const existing = profile.conditions || '';
    const newOnes = conditions.filter((c) => !existing.toLowerCase().includes(c.toLowerCase()));
    if (newOnes.length > 0) {
      await db.update(careProfiles).set({ conditions: existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n') }).where(eq(careProfiles.id, profile.id));
    }
  }

  if (allergies.length > 0) {
    const existing = profile.allergies || '';
    const newOnes = allergies.filter((a) => !existing.toLowerCase().includes(a.toLowerCase()));
    if (newOnes.length > 0) {
      await db.update(careProfiles).set({ allergies: existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n') }).where(eq(careProfiles.id, profile.id));
    }
  }

  for (const appt of appointments) {
    if (appt.date_time) {
      const existing = await db
        .select({ id: apptsTable.id })
        .from(apptsTable)
        .where(eq(apptsTable.careProfileId, profile.id))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(apptsTable).values({ careProfileId: profile.id, doctorName: appt.doctor_name, dateTime: appt.date_time ? new Date(appt.date_time) : null });
      }
    }
  }

  if (labs.length > 0) {
    await db.delete(labResultsTable).where(eq(labResultsTable.userId, userId));
    await db.insert(labResultsTable).values(labs.map((l) => ({ userId, testName: l.test_name, value: l.value, unit: l.unit, referenceRange: l.reference_range, isAbnormal: l.is_abnormal, dateTaken: l.date_taken, source: providerId })));
  }
}
