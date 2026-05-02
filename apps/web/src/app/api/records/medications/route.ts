import { db } from '@/lib/db';
import { medications, careProfiles } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';
import { softDelete } from '@/lib/soft-delete';
import { triggerMatchingRun } from '@/lib/trials/matchingQueue';

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

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return apiError('name is required', 400);
  if (trimmedName.length > 200) return apiError('name too long (max 200 characters)', 400);
  if (dose && String(dose).length > 100) return apiError('dose too long (max 100 characters)', 400);
  if (frequency && String(frequency).length > 200) return apiError('frequency too long (max 200 characters)', 400);
  if (notes && String(notes).length > 2000) return apiError('notes too long (max 2000 characters)', 400);
  if (refill_date) {
    if (typeof refill_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(refill_date) || isNaN(new Date(refill_date).getTime())) {
      return apiError('refill_date must be a valid date in YYYY-MM-DD format', 400);
    }
  }

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
    name: trimmedName,
    dose: dose || null,
    frequency: frequency || null,
    prescribingDoctor: prescribing_doctor || null,
    refillDate: refill_date || null,
    notes: notes || null,
  }).returning();

  void triggerMatchingRun(profileId, 'new_medication');

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

  // Verify ownership via care profile (exclude soft-deleted medications)
  const [med] = await db
    .select({ careProfileId: medications.careProfileId })
    .from(medications)
    .where(and(eq(medications.id, id), isNull(medications.deletedAt)))
    .limit(1);

  if (!med) return apiError('Not found', 404);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, med.careProfileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);

  if (!profile) return apiError('Forbidden', 403);

  const result = await softDelete('medications', id, dbUser!.id, profile.id);
  void triggerMatchingRun(profile.id, 'profile_update');
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
  if (refill_date) {
    if (typeof refill_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(refill_date) || isNaN(new Date(refill_date).getTime())) {
      return apiError('refill_date must be a valid date in YYYY-MM-DD format', 400);
    }
  }

  // Verify ownership via care profile (exclude soft-deleted medications)
  const [med] = await db
    .select({ careProfileId: medications.careProfileId })
    .from(medications)
    .where(and(eq(medications.id, id), isNull(medications.deletedAt)))
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
  if (meds.length > 100) return apiError('Too many medications in one request (max 100)', 400);

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1);
  if (!profile) return apiError('Forbidden', 403);

  const rows = meds
    .filter((m) => m.name && typeof m.name === 'string' && m.name.trim())
    .map((m) => ({
      careProfileId: profile.id,
      name: String(m.name).trim().slice(0, 200),
      dose: m.dose ? String(m.dose).slice(0, 100) : null,
      frequency: m.frequency ? String(m.frequency).slice(0, 200) : null,
      prescribingDoctor: m.prescribing_doctor ? String(m.prescribing_doctor).slice(0, 200) : null,
      refillDate: m.refill_date && /^\d{4}-\d{2}-\d{2}$/.test(String(m.refill_date)) ? String(m.refill_date) : null,
      notes: m.notes ? String(m.notes).slice(0, 2000) : null,
    }));

  if (rows.length === 0) return apiError('No valid medications provided', 400);

  const inserted = await db.insert(medications).values(rows).returning();

  void triggerMatchingRun(profile.id, 'new_medication');

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
