import { db } from '@/lib/db';
import { careProfiles } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateCsrf } from '@/lib/csrf';

// GET — fetch the current user's care profile
export async function GET() {
  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const [profile] = await db
    .select()
    .from(careProfiles)
    .where(eq(careProfiles.userId, dbUser!.id))
    .limit(1);

  if (!profile) return apiError('No care profile found', 404);
  return apiSuccess(profile);
}

// PATCH — update care profile fields
export async function PATCH(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{
    id?: string;
    patient_name?: string; patient_age?: number; relationship?: string;
    cancer_type?: string; cancer_stage?: string; treatment_phase?: string;
    conditions?: string; allergies?: string; onboarding_completed?: boolean;
    onboarding_priorities?: string[] | null;
  }>(req);
  if (bodyError) return bodyError;
  const { id, ...fields } = body;

  // Map snake_case client fields to camelCase schema columns
  const allowed: Record<string, unknown> = {};
  if (fields.patient_name !== undefined) allowed.patientName = fields.patient_name;
  if (fields.patient_age !== undefined) allowed.patientAge = fields.patient_age;
  if (fields.relationship !== undefined) allowed.relationship = fields.relationship;
  if (fields.cancer_type !== undefined) allowed.cancerType = fields.cancer_type;
  if (fields.cancer_stage !== undefined) allowed.cancerStage = fields.cancer_stage;
  if (fields.treatment_phase !== undefined) allowed.treatmentPhase = fields.treatment_phase;
  if (fields.conditions !== undefined) allowed.conditions = fields.conditions;
  if (fields.allergies !== undefined) allowed.allergies = fields.allergies;
  if (fields.onboarding_completed !== undefined) allowed.onboardingCompleted = fields.onboarding_completed;
  if (fields.onboarding_priorities !== undefined) allowed.onboardingPriorities = fields.onboarding_priorities;

  if (Object.keys(allowed).length === 0) return apiError('No valid fields to update', 400);

  // Verify ownership
  let profileId = id;
  if (!profileId) {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1);
    if (!profile) return apiError('No care profile found', 404);
    profileId = profile.id;
  } else {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
      .limit(1);
    if (!profile || profile.id !== profileId) return apiError('Forbidden', 403);
  }

  const [updated] = await db
    .update(careProfiles)
    .set(allowed)
    .where(eq(careProfiles.id, profileId))
    .returning();

  return apiSuccess(updated);
}

// POST — create a care profile
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req);
  if (!valid) return csrfError!;

  const { user: dbUser, error } = await getAuthenticatedUser();
  if (error) return error;

  const { body, error: bodyError } = await parseBody<{
    patient_name?: string; patient_age?: number; relationship?: string;
    cancer_type?: string; cancer_stage?: string; treatment_phase?: string;
    conditions?: string; allergies?: string; onboarding_completed?: boolean;
    onboarding_priorities?: string[] | null;
  }>(req);
  if (bodyError) return bodyError;

  const [profile] = await db.insert(careProfiles).values({
    userId: dbUser!.id,
    patientName: body.patient_name || null,
    patientAge: body.patient_age || null,
    relationship: body.relationship || null,
    cancerType: body.cancer_type || null,
    cancerStage: body.cancer_stage || null,
    treatmentPhase: body.treatment_phase || null,
    conditions: body.conditions || null,
    allergies: body.allergies || null,
    onboardingCompleted: body.onboarding_completed || false,
    onboardingPriorities: body.onboarding_priorities || [],
  }).returning();

  return apiSuccess(profile);
}
