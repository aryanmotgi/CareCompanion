import { db } from '@/lib/db';
import { connectedApps, careProfiles, medications, appointments, labResults, notifications } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
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
  const body = await req.json();
  const { user_id } = body;

  if (!user_id) {
    return Response.json({ error: 'user_id required' }, { status: 400 });
  }

  // Auth: either (a) authenticated user session, or (b) server-side OAuth callback
  const { user: dbUser, error: authError } = await getAuthenticatedUser();

  if (!authError && dbUser) {
    if (dbUser.id !== user_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    const internalSecret = req.headers.get('x-internal-secret');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || internalSecret !== cronSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const [connection] = await db
    .select()
    .from(connectedApps)
    .where(and(eq(connectedApps.userId, user_id), eq(connectedApps.source, 'health_system')))
    .limit(1);

  if (!connection?.accessToken) {
    return Response.json({ error: 'Not connected' }, { status: 400 });
  }

  const [profile] = await db
    .select({ id: careProfiles.id, conditions: careProfiles.conditions, allergies: careProfiles.allergies })
    .from(careProfiles)
    .where(eq(careProfiles.userId, user_id))
    .limit(1);

  if (!profile) {
    return Response.json({ error: 'No care profile' }, { status: 400 });
  }

  const token = connection.accessToken;

  const [medBundle, condBundle, allergyBundle, apptBundle, labBundle] = await Promise.all([
    fetchFhirBundle(token, 'MedicationRequest'),
    fetchFhirBundle(token, 'Condition'),
    fetchFhirBundle(token, 'AllergyIntolerance'),
    fetchFhirBundle(token, 'Appointment'),
    fetchFhirBundle(token, 'Observation'),
  ]);

  const meds = parseMedications(medBundle);
  const conditions = parseConditions(condBundle);
  const allergies = parseAllergies(allergyBundle);
  const appts = parseAppointments(apptBundle);
  const labs = parseLabResults(labBundle);

  // Import medications
  for (const med of meds) {
    const existing = await db
      .select({ id: medications.id })
      .from(medications)
      .where(and(eq(medications.careProfileId, profile.id), eq(medications.name, med.name)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(medications).values({
        careProfileId: profile.id,
        name: med.name,
        dose: med.dose,
        frequency: med.frequency,
        notes: 'Imported from health system via FHIR',
      });
    }
  }

  // Update conditions and allergies
  if (conditions.length > 0) {
    const existing = profile.conditions || '';
    const newOnes = conditions.filter((c) => !existing.includes(c));
    if (newOnes.length > 0) {
      const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
      await db.update(careProfiles).set({ conditions: updated }).where(eq(careProfiles.id, profile.id));
    }
  }

  if (allergies.length > 0) {
    const existing = profile.allergies || '';
    const newOnes = allergies.filter((a) => !existing.includes(a));
    if (newOnes.length > 0) {
      const updated = existing ? `${existing}\n${newOnes.join('\n')}` : newOnes.join('\n');
      await db.update(careProfiles).set({ allergies: updated }).where(eq(careProfiles.id, profile.id));
    }
  }

  // Import appointments
  for (const appt of appts) {
    await db.insert(appointments).values({
      careProfileId: profile.id,
      doctorName: appt.doctor_name,
      dateTime: appt.date_time ? new Date(appt.date_time) : null,
      purpose: appt.purpose,
    });
  }

  // Import lab results
  for (const lab of labs) {
    const existing = await db
      .select({ id: labResults.id })
      .from(labResults)
      .where(and(
        eq(labResults.userId, user_id),
        eq(labResults.testName, lab.test_name),
        eq(labResults.dateTaken, lab.date_taken || ''),
      ))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(labResults).values({
        userId: user_id,
        testName: lab.test_name,
        value: lab.value,
        unit: lab.unit,
        referenceRange: lab.reference_range,
        isAbnormal: lab.is_abnormal,
        dateTaken: lab.date_taken,
        source: 'health_system',
      });

      if (lab.is_abnormal) {
        await db.insert(notifications).values({
          userId: user_id,
          type: 'lab_result',
          title: `Abnormal lab result: ${lab.test_name}`,
          message: `${lab.test_name}: ${lab.value} ${lab.unit || ''} (range: ${lab.reference_range || 'N/A'})`,
        });
      }
    }
  }

  await db.update(connectedApps).set({ lastSynced: new Date() }).where(eq(connectedApps.id, connection.id));

  return Response.json({
    success: true,
    imported: {
      medications: meds.length,
      conditions: conditions.length,
      allergies: allergies.length,
      appointments: appts.length,
      labResults: labs.length,
    },
  });
}
