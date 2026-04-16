import { db } from '@/lib/db';
import { doctors, careProfiles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';

// POST — add a doctor
export async function POST(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const body = await req.json();
  const { name, specialty, phone, notes, care_profile_id } = body;
  if (!name) return apiError('name is required', 400);

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

  const [doc] = await db.insert(doctors).values({
    careProfileId: profileId,
    name,
    specialty: specialty || null,
    phone: phone || null,
    notes: notes || null,
  }).returning();

  return apiSuccess(doc);
}

// DELETE — remove a doctor by id
export async function DELETE(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { id } = await req.json();
  if (!id) return apiError('id is required', 400);

  const [doc] = await db
    .select({ careProfileId: doctors.careProfileId })
    .from(doctors)
    .where(eq(doctors.id, id))
    .limit(1);

  if (!doc) return apiError('Not found', 404);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, doc.careProfileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  await db.delete(doctors).where(eq(doctors.id, id));
  return apiSuccess({ success: true });
}
