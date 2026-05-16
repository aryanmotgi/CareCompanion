import { db } from '@/lib/db'
import { medicationObservations, medications, careProfiles } from '@/lib/db/schema'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { getAuthenticatedUser, parseBody } from '@/lib/api-helpers'
import { apiError, apiSuccess } from '@/lib/api-response'
import { validateCsrf } from '@/lib/csrf'

const OBSERVATION_TYPES = ['dose_taken', 'dose_skipped', 'dose_partial', 'dose_delayed', 'other'] as const
const RESOLUTION_ACTIONS = ['intentional_change', 'caregiver_error', 'clinical_review_needed', 'no_action'] as const

type ObservationType = (typeof OBSERVATION_TYPES)[number]
type ResolutionAction = (typeof RESOLUTION_ACTIONS)[number]

// Normalise a dose string for comparison: lowercase, collapse whitespace.
// "10 mg" and "10mg" should not trigger a false positive.
function normaliseDose(dose: string): string {
  return dose.toLowerCase().replace(/\s+/g, '').trim()
}

function detectDiscrepancy(
  observationType: ObservationType,
  doseReported: string | null | undefined,
  ehrDose: string | null | undefined,
): { flag: boolean; type: string | null } {
  if (observationType === 'dose_skipped') {
    return { flag: true, type: 'DOSE_SKIPPED' }
  }
  if (doseReported && ehrDose) {
    const differs = normaliseDose(doseReported) !== normaliseDose(ehrDose)
    return { flag: differs, type: differs ? 'DOSE_DIFFERS' : null }
  }
  return { flag: false, type: null }
}

// POST — log a caregiver observation
export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const { body, error: bodyError } = await parseBody<Record<string, unknown>>(req)
  if (bodyError) return bodyError

  const {
    medication_id,
    care_profile_id,
    observation_type,
    dose_reported,
    notes,
  } = body as {
    medication_id?: string
    care_profile_id?: string
    observation_type?: string
    dose_reported?: string
    notes?: string
  }

  if (!medication_id) return apiError('medication_id is required', 400)
  if (!observation_type) return apiError('observation_type is required', 400)
  if (!OBSERVATION_TYPES.includes(observation_type as ObservationType)) {
    return apiError(`observation_type must be one of: ${OBSERVATION_TYPES.join(', ')}`, 400)
  }
  if (dose_reported && dose_reported.length > 100) return apiError('dose_reported too long (max 100 characters)', 400)
  if (notes && notes.length > 2000) return apiError('notes too long (max 2000 characters)', 400)

  // Resolve care profile
  let profileId: string
  if (care_profile_id) {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(and(eq(careProfiles.id, care_profile_id), eq(careProfiles.userId, dbUser!.id)))
      .limit(1)
    if (!profile) return apiError('Forbidden', 403)
    profileId = profile.id
  } else {
    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, dbUser!.id))
      .limit(1)
    if (!profile) return apiError('No care profile found', 404)
    profileId = profile.id
  }

  // Verify medication belongs to this care profile and is not deleted
  const [med] = await db
    .select({ id: medications.id, dose: medications.dose })
    .from(medications)
    .where(
      and(
        eq(medications.id, medication_id),
        eq(medications.careProfileId, profileId),
        isNull(medications.deletedAt),
      ),
    )
    .limit(1)
  if (!med) return apiError('Medication not found', 404)

  const ehrDose = med.dose ?? null
  const { flag: discrepancyFlag, type: discrepancyType } = detectDiscrepancy(
    observation_type as ObservationType,
    dose_reported,
    ehrDose,
  )

  const [obs] = await db
    .insert(medicationObservations)
    .values({
      careProfileId:   profileId,
      medicationId:    medication_id,
      reportedBy:      dbUser!.id,
      observationType: observation_type,
      doseReported:    dose_reported ?? null,
      notes:           notes ?? null,
      discrepancyFlag,
      discrepancyType: discrepancyType ?? null,
      ehrDoseAtTime:   discrepancyFlag ? ehrDose : null,
    })
    .returning()

  return apiSuccess({ ...obs, discrepancy_detected: discrepancyFlag }, discrepancyFlag ? 201 : 201)
}

// GET — list observations for a care profile
// Query params: care_profile_id (required), medication_id (optional), open_only (optional)
export async function GET(req: Request) {
  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const url = new URL(req.url)
  const profileId = url.searchParams.get('care_profile_id')
  const medicationId = url.searchParams.get('medication_id')
  const openOnly = url.searchParams.get('open_only') === 'true'

  if (!profileId) return apiError('care_profile_id is required', 400)

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, profileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1)
  if (!profile) return apiError('Forbidden', 403)

  const conditions = [eq(medicationObservations.careProfileId, profileId)]
  if (medicationId) conditions.push(eq(medicationObservations.medicationId, medicationId))
  if (openOnly) {
    conditions.push(eq(medicationObservations.discrepancyFlag, true))
    conditions.push(isNull(medicationObservations.resolvedAt))
  }

  const rows = await db
    .select()
    .from(medicationObservations)
    .where(and(...conditions))
    .orderBy(desc(medicationObservations.reportedAt))
    .limit(200)

  return apiSuccess(rows)
}

// PATCH — resolve an open discrepancy
export async function PATCH(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const { user: dbUser, error } = await getAuthenticatedUser()
  if (error) return error

  const { body, error: bodyError } = await parseBody<Record<string, unknown>>(req)
  if (bodyError) return bodyError

  const { id, resolution_action, resolution_notes } = body as {
    id?: string
    resolution_action?: string
    resolution_notes?: string
  }

  if (!id) return apiError('id is required', 400)
  if (!resolution_action) return apiError('resolution_action is required', 400)
  if (!RESOLUTION_ACTIONS.includes(resolution_action as ResolutionAction)) {
    return apiError(`resolution_action must be one of: ${RESOLUTION_ACTIONS.join(', ')}`, 400)
  }
  if (resolution_notes && resolution_notes.length > 2000) return apiError('resolution_notes too long (max 2000 characters)', 400)

  // Verify ownership via care profile
  const [obs] = await db
    .select({ careProfileId: medicationObservations.careProfileId, resolvedAt: medicationObservations.resolvedAt })
    .from(medicationObservations)
    .where(eq(medicationObservations.id, id))
    .limit(1)
  if (!obs) return apiError('Not found', 404)

  if (obs.resolvedAt) return apiError('Observation already resolved', 409)

  const [profile] = await db
    .select({ id: careProfiles.id })
    .from(careProfiles)
    .where(and(eq(careProfiles.id, obs.careProfileId), eq(careProfiles.userId, dbUser!.id)))
    .limit(1)
  if (!profile) return apiError('Forbidden', 403)

  const [updated] = await db
    .update(medicationObservations)
    .set({
      resolvedAt:       new Date(),
      resolvedBy:       dbUser!.id,
      resolutionAction: resolution_action,
      resolutionNotes:  resolution_notes ?? null,
    })
    .where(eq(medicationObservations.id, id))
    .returning()

  return apiSuccess(updated)
}
