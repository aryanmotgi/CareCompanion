import { db } from '@/lib/db';
import { medications, careProfiles } from '@/lib/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';

// POST — add a medication
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await req.json();
  const { name, dose, frequency, prescribing_doctor, refill_date, notes, care_profile_id } = body;

  if (!name) return apiError('name is required', 400);

  // Resolve care profile
  let profileId = care_profile_id;
  if (!profileId) {
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

  return apiSuccess(med);
}

// DELETE — remove a medication by id
export async function DELETE(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await req.json();
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

  await db.delete(medications).where(eq(medications.id, id));
  return apiSuccess({ success: true });
}

// PATCH — update a medication's refill date
export async function PATCH(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id, refill_date } = await req.json();
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
    .where(eq(medications.careProfileId, profileId))
    .orderBy(desc(medications.createdAt));

  return apiSuccess(meds);
}
