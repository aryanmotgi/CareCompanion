import { db } from '@/lib/db';
import { doctors, careProfiles } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { softDelete } from '@/lib/soft-delete';

// POST — add a doctor
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<Record<string, unknown>>(req);
  if (bodyError) return bodyError;
  const { name, specialty, phone, notes, care_profile_id } = body as {
    name?: string; specialty?: string; phone?: string; notes?: string; care_profile_id?: string;
  };
  if (!name) return apiError('name is required', 400);

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
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ id?: string }>(req);
  if (bodyError) return bodyError;
  const { id } = body;
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

  const result = await softDelete('doctors', id, dbUser!.id, profile.id);
  return apiSuccess(result);
}

// PUT — bulk-create doctors during onboarding
export async function PUT(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{ profileId?: string; doctors?: Array<Record<string, unknown>> }>(req);
  if (bodyError) return bodyError;
  const { profileId, doctors: docs } = body;
  if (!profileId) return apiError('profileId is required', 400);
  if (!Array.isArray(docs) || docs.length === 0) return apiError('doctors array is required', 400);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);
  if (!profile) return apiError('Forbidden', 403);

  const rows = docs.map((d) => ({
    careProfileId: profile.id,
    name: String(d.name),
    specialty: d.specialty ? String(d.specialty) : null,
    phone: d.phone ? String(d.phone) : null,
    notes: d.notes ? String(d.notes) : null,
  }));

  const inserted = await db.insert(doctors).values(rows).returning();
  return apiSuccess(inserted);
}

// GET — list doctors for a care profile
export async function GET(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const url = new URL(req.url);
  const profileId = url.searchParams.get('care_profile_id');
  if (!profileId) return apiError('care_profile_id is required', 400);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  const docs = await db
    .select()
    .from(doctors)
    .where(and(eq(doctors.careProfileId, profileId), isNull(doctors.deletedAt)))
    .orderBy(desc(doctors.createdAt));

  return apiSuccess(docs);
}
