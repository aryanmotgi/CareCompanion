import { db } from '@/lib/db';
import { medications, careProfiles } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { softDelete } from '@/lib/soft-delete';
import { enqueueMatchingRun, processMatchingQueueForProfile } from '@/lib/trials/matchingQueue';

// POST — add a medication
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<Record<string, unknown>>(req);
  if (bodyError) return bodyError;
  const { name, dose, frequency, prescribing_doctor, refill_date, notes, care_profile_id } = body as {
    name?: string; dose?: string; frequency?: string; prescribing_doctor?: string;
    refill_date?: string; notes?: string; care_profile_id?: string;
  };

  if (!name) return apiError('name is required', 400);

  // Resolve and verify care profile ownership
  let profileId: string;
  if (care_profile_id) {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, care_profile_id), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);
    if (!profile) return apiError('Forbidden', 403);
    profileId = profile.id;
  } else {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1);
    if (!profile) return apiError('No care profile found', 404);
    profileId = profile.id;
  }

  const [med] = await db.insert(medications).values({
    careProfileId: profileId,
    name,
    dose: dose || null,
    frequency: frequency || null,
    prescribingDoctor: prescribing_doctor || null,
    refillDate: refill_date || null,
    notes: notes || null,
  }).returning();

  void enqueueMatchingRun(profileId, 'new_medication').then(() =>
    void processMatchingQueueForProfile(profileId)
  );

  return apiSuccess(med);
}

// DELETE — remove a medication by id
export async function DELETE(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ id?: string }>(req);
  if (bodyError) return bodyError;
  const { id } = body;
  if (!id) return apiError('id is required', 400);

  // Verify ownership via care profile
  const [med] = await db
    .select({ careProfileId: medications.careProfileId })
    .from(medications)
    .where(eq(medications.id, id))
    .limit(1);

  if (!med) return apiError('Not found', 404);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, med.careProfileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  const result = await softDelete('medications', id, dbUser!.id, profile.id);
  return apiSuccess(result);
}

// PATCH — update a medication's refill date
export async function PATCH(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ id?: string; refill_date?: string }>(req);
  if (bodyError) return bodyError;
  const { id, refill_date } = body;
  if (!id) return apiError('id is required', 400);

  // Verify ownership via care profile
  const [med] = await db
    .select({ careProfileId: medications.careProfileId })
    .from(medications)
    .where(eq(medications.id, id))
    .limit(1);

  if (!med) return apiError('Not found', 404);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, med.careProfileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  const [updated] = await db
    .update(medications)
    .set({ refillDate: refill_date || null })
    .where(eq(medications.id, id))
    .returning();

  return apiSuccess(updated);
}

// PUT — bulk-create medications during onboarding
export async function PUT(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ profileId?: string; medications?: Array<Record<string, unknown>> }>(req);
  if (bodyError) return bodyError;
  const { profileId, medications: meds } = body;
  if (!profileId) return apiError('profileId is required', 400);
  if (!Array.isArray(meds) || meds.length === 0) return apiError('medications array is required', 400);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);
  if (!profile) return apiError('Forbidden', 403);

  const rows = meds.map((m) => ({
    careProfileId: profile.id,
    name: String(m.name),
    dose: m.dose ? String(m.dose) : null,
    frequency: m.frequency ? String(m.frequency) : null,
    prescribingDoctor: m.prescribing_doctor ? String(m.prescribing_doctor) : null,
    refillDate: m.refill_date ? String(m.refill_date) : null,
    notes: m.notes ? String(m.notes) : null,
  }));

  const inserted = await db.insert(medications).values(rows).returning();

  void enqueueMatchingRun(profile.id, 'new_medication').then(() =>
    void processMatchingQueueForProfile(profile.id)
  );

  return apiSuccess(inserted);
}

// GET — list medications for a care profile
export async function GET(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(req.url);
  const profileId = url.searchParams.get('care_profile_id');

  if (!profileId) return apiError('care_profile_id is required', 400);

  // Verify ownership
  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  const meds = await db
    .select()
    .from(medications)
    .where(and(eq(medications.careProfileId, profileId), isNull(medications.deletedAt)))
    .orderBy(desc(medications.createdAt));

  return apiSuccess(meds);
}
