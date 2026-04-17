import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { rateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { validateCsrf } from '@/lib/csrf';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sharedLinks, careProfiles, medications, appointments, labResults, doctors } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 });

const ShareSchema = z.object({
  type: z.enum(['health_summary', 'medications', 'lab_results', 'care_plan']).default('health_summary'),
});

async function buildShareData(type: string, profileId: string) {
  switch (type) {
    case 'medications': {
      const meds = await db.select().from(medications)
        .where(and(eq(medications.careProfileId, profileId), isNull(medications.deletedAt)));
      return { medications: meds.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency, prescribingDoctor: m.prescribingDoctor, refillDate: m.refillDate, notes: m.notes })) };
    }
    case 'lab_results': {
      // labResults is keyed by userId — fetch user from profileId via careProfiles
      const [prof] = await db.select({ userId: careProfiles.userId }).from(careProfiles).where(eq(careProfiles.id, profileId)).limit(1);
      const labs = prof ? await db.select().from(labResults)
        .where(eq(labResults.userId, prof.userId))
        .limit(20) : [];
      return { lab_results: labs.map(l => ({ name: l.testName, value: l.value, unit: l.unit, referenceRange: l.referenceRange, date: l.dateTaken, isAbnormal: l.isAbnormal })) };
    }
    case 'care_plan':
    case 'health_summary':
    default: {
      const [profile] = await db.select().from(careProfiles).where(eq(careProfiles.id, profileId)).limit(1);
      const [meds, appts, docs] = await Promise.all([
        db.select().from(medications).where(and(eq(medications.careProfileId, profileId), isNull(medications.deletedAt))),
        db.select().from(appointments).where(eq(appointments.careProfileId, profileId)).limit(10),
        db.select().from(doctors).where(eq(doctors.careProfileId, profileId)),
      ]);
      return {
        patient: {
          name: profile?.patientName,
          cancerType: profile?.cancerType,
          cancerStage: profile?.cancerStage,
          treatmentPhase: profile?.treatmentPhase,
          conditions: profile?.conditions,
          allergies: profile?.allergies,
        },
        medications: meds.map(m => ({ name: m.name, dose: m.dose, frequency: m.frequency, prescribingDoctor: m.prescribingDoctor, notes: m.notes })),
        appointments: appts.map(a => ({ doctorName: a.doctorName, specialty: a.specialty, dateTime: a.dateTime, location: a.location, purpose: a.purpose })),
        care_team: docs.map(d => ({ name: d.name, specialty: d.specialty, phone: d.phone })),
      };
    }
  }
}

export async function POST(request: Request) {
  const { valid, error: csrfError } = await validateCsrf(request);
  if (!valid) return csrfError!;

  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const { success } = limiter.check(ip);
  if (!success) return apiError('Too many requests', 429);

  try {
    const { user, error: authError } = await getAuthenticatedUser();
    if (authError) return authError;

    const body = await request.json();
    const { data: validated, error: valError } = validateBody(ShareSchema, body);
    if (valError) return valError;
    const { type } = validated;

    const [profile] = await db.select({ id: careProfiles.id, patientName: careProfiles.patientName })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1);

    if (!profile) return apiError('No care profile found', 404);

    const shareData = await buildShareData(type, profile.id);
    const titles: Record<string, string> = {
      health_summary: 'Health Summary',
      medications: 'Medication List',
      lab_results: 'Lab Results',
      care_plan: 'Care Plan',
    };
    const title = `${profile.patientName ? profile.patientName + "'s " : ''}${titles[type] || 'Health Summary'}`;

    const shareToken = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [link] = await db.insert(sharedLinks).values({
      userId: user!.id,
      careProfileId: profile.id,
      token: shareToken,
      type,
      title,
      data: shareData,
      expiresAt,
    }).returning();

    await logAudit({
      user_id: user!.id,
      action: 'share_data',
      ip_address: request.headers.get('x-forwarded-for') || undefined,
    });

    const shareUrl = `https://carecompanionai.org/shared/${link.token}`;
    return apiSuccess({ url: shareUrl, expiresAt: expiresAt.toISOString(), token: link.token });
  } catch (err) {
    console.error('[share] POST error:', err);
    return apiError('Internal server error', 500);
  }
}
