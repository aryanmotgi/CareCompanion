import { getAuthenticatedUser } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { connectedApps, careProfiles, medications as medsTable, labResults as labResultsTable, appointments as apptsTable, claims as claimsTable, insurance as insuranceTable, notifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
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
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { provider_id } = await req.json();
  if (!provider_id) {
    return Response.json({ error: 'provider_id required' }, { status: 400 });
  }

  const provider = getProvider(provider_id);
  if (!provider) {
    return Response.json({ error: `Unknown provider: ${provider_id}` }, { status: 400 });
  }

  const source = provider_id === '1uphealth' ? '1uphealth' : `fhir_${provider_id}`;

  const [connection] = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, dbUser!.id), eq(connectedApps.source, source)))
    .limit(1);

  if (!connection?.accessToken) {
    return Response.json({ error: 'Not connected to this provider' }, { status: 400 });
  }

  const decryptedToken = safeDecryptToken(connection.accessToken);
  if (!decryptedToken) {
    return Response.json({ error: 'Token decryption failed — please reconnect' }, { status: 401 });
  }
  let accessToken: string = decryptedToken;

  // Check if token is expired and refresh if needed
  if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
    const storedRefresh = safeDecryptToken(connection.refreshToken || '');
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

      const newRefresh = newTokens.refresh_token
        ? encryptToken(newTokens.refresh_token)
        : connection.refreshToken;
      await db.update(connectedApps).set({
        accessToken: encryptToken(newTokens.access_token),
        refreshToken: newRefresh,
        expiresAt: newTokens.expires_in
          ? new Date(Date.now() + newTokens.expires_in * 1000)
          : connection.expiresAt,
      }).where(eq(connectedApps.id, connection.id));
    } catch (err) {
      console.error('Token refresh error:', err);
      return Response.json({ error: 'Token refresh failed' }, { status: 401 });
    }
  }

  if (provider_id === '1uphealth') {
    try {
      const results = await syncOneUpData(dbUser!.id, accessToken);
      return Response.json({ success: true, provider: provider.name, synced: results });
    } catch (err) {
      console.error('1upHealth sync error:', err);
      return Response.json({ error: 'Sync failed' }, { status: 500 });
    }
  }

  // Get or create care profile
  let [profile] = await db
    .select({ id: careProfiles.id, conditions: careProfiles.conditions, allergies: careProfiles.allergies })
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1);

  if (!profile) {
    const [newProfile] = await db
      .insert(careProfiles)
      .values({ userId: dbUser!.id })
      .returning({ id: careProfiles.id, conditions: careProfiles.conditions, allergies: careProfiles.allergies });
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

  const medications = parseMedications(medBundle);
  const conditions = parseConditions(condBundle);
  const allergies = parseAllergies(allergyBundle);
  const appointments = parseAppointments(apptBundle);
  const labs = parseLabResults(labBundle);
  const claimsData = parseClaims(claimBundle);
  const coverage = parseCoverage(coverageBundle);

  const syncSource = `Synced from ${provider.name}`;
  if (medications.length > 0) {
    await db.delete(medsTable).where(and(eq(medsTable.careProfileId, profile.id), eq(medsTable.notes, syncSource)));
    await db.insert(medsTable).values(
      medications.map((m) => ({
        careProfileId: profile.id,
        name: m.name,
        dose: m.dose,
        frequency: m.frequency,
        notes: syncSource,
      }))
    );
    results.medications = medications.length;
  }

  if (conditions.length > 0) {
    const existing = profile.conditions || '';
    const newOnes = conditions.filter((c) => !existing.toLowerCase().includes(c.toLowerCase()));
    if (newOnes.length > 0) {
      const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
      await db.update(careProfiles).set({ conditions: updated }).where(eq(careProfiles.id, profile.id));
      results.conditions = newOnes.length;
    }
  }

  if (allergies.length > 0) {
    const existing = profile.allergies || '';
    const newOnes = allergies.filter((a) => !existing.toLowerCase().includes(a.toLowerCase()));
    if (newOnes.length > 0) {
      const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
      await db.update(careProfiles).set({ allergies: updated }).where(eq(careProfiles.id, profile.id));
      results.allergies = newOnes.length;
    }
  }

  for (const appt of appointments) {
    if (appt.date_time) {
      const apptDateTime = new Date(appt.date_time);
      const existing = await db
        .select({ id: apptsTable.id })
        .from(apptsTable)
        .where(and(eq(apptsTable.careProfileId, profile.id), eq(apptsTable.dateTime, apptDateTime)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(apptsTable).values({
          careProfileId: profile.id,
          doctorName: appt.doctor_name,
          dateTime: apptDateTime,
          purpose: appt.purpose,
        });
        results.appointments++;
      }
    }
  }

  if (labs.length > 0) {
    await db.delete(labResultsTable).where(and(eq(labResultsTable.userId, dbUser!.id), eq(labResultsTable.source, provider_id)));
    await db.insert(labResultsTable).values(
      labs.map((l) => ({
        userId: dbUser!.id,
        testName: l.test_name,
        value: l.value,
        unit: l.unit,
        referenceRange: l.reference_range,
        isAbnormal: l.is_abnormal,
        dateTaken: l.date_taken,
        source: provider_id,
      }))
    );
    results.lab_results = labs.length;

    const abnormal = labs.filter((l) => l.is_abnormal);
    for (const lab of abnormal) {
      await db.insert(notifications).values({
        userId: dbUser!.id,
        type: 'lab_result',
        title: `Abnormal lab result: ${lab.test_name}`,
        message: `${lab.test_name}: ${lab.value} ${lab.unit || ''} (range: ${lab.reference_range || 'N/A'}) — synced from ${provider.name}`,
      });
    }
  }

  if (claimsData.length > 0) {
    for (const claim of claimsData) {
      await db.insert(claimsTable).values({
        userId: dbUser!.id,
        providerName: claim.provider_name,
        serviceDate: claim.service_date,
        billedAmount: String(claim.billed_amount || 0),
        paidAmount: String(claim.paid_amount || 0),
        patientResponsibility: String(claim.patient_responsibility || 0),
        status: claim.status || 'processed',
      });
    }
    results.claims = claimsData.length;
  }

  if (coverage.length > 0) {
    for (const cov of coverage) {
      await db.insert(insuranceTable).values({
        userId: dbUser!.id,
        provider: cov.provider,
        memberId: cov.member_id,
        groupNumber: cov.group_number,
        planYear: new Date().getFullYear(),
      }).onConflictDoUpdate({
        target: insuranceTable.userId,
        set: {
          provider: cov.provider,
          memberId: cov.member_id,
          groupNumber: cov.group_number,
        },
      });
    }
    results.insurance = coverage.length;
  }

  await db.update(connectedApps).set({ lastSynced: new Date() }).where(eq(connectedApps.id, connection.id));

  return Response.json({ success: true, provider: provider.name, synced: results });
}
