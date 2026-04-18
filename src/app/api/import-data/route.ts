import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'
import { validateCsrf } from '@/lib/csrf'
import { db } from '@/lib/db'
import { careProfiles, medications, appointments, labResults } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const importSchema = z.object({
  medications: z.array(z.object({
    name: z.string(),
    dose: z.string().optional(),
    frequency: z.string().optional(),
  })).optional(),
  appointments: z.array(z.object({
    doctor_name: z.string(),
    specialty: z.string().optional(),
    date: z.string().optional(),
    time: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  lab_results: z.array(z.object({
    test_name: z.string(),
    value: z.string().optional(),
    unit: z.string().optional(),
    reference_range: z.string().optional(),
    is_abnormal: z.boolean().optional(),
    date_taken: z.string().optional(),
  })).optional(),
})

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid or missing request body', 400)
    }

    const { data: parsed, error: valError } = validateBody(importSchema, body)
    if (valError) return valError

    const [profile] = await db
      .select({ id: careProfiles.id })
      .from(careProfiles)
      .where(eq(careProfiles.userId, user!.id))
      .limit(1)

    if (!profile) return apiError('No profile found', 404)

    const results = { medications: 0, appointments: 0, lab_results: 0 }

    if (parsed.medications?.length) {
      const rows = parsed.medications.map(m => ({
        careProfileId: profile.id,
        name: m.name,
        dose: m.dose ?? null,
        frequency: m.frequency ?? null,
      }))
      const inserted = await db.insert(medications).values(rows).returning()
      results.medications = inserted.length
    }

    if (parsed.appointments?.length) {
      const rows = parsed.appointments.map(a => ({
        careProfileId: profile.id,
        doctorName: a.doctor_name ?? null,
        specialty: a.specialty ?? null,
        location: a.location ?? null,
      }))
      const inserted = await db.insert(appointments).values(rows).returning()
      results.appointments = inserted.length
    }

    if (parsed.lab_results?.length) {
      const rows = parsed.lab_results.map(l => ({
        userId: user!.id,
        testName: l.test_name,
        value: l.value ?? null,
        unit: l.unit ?? null,
        referenceRange: l.reference_range ?? null,
        isAbnormal: l.is_abnormal ?? false,
        dateTaken: l.date_taken ?? null,
      }))
      const inserted = await db.insert(labResults).values(rows).returning()
      results.lab_results = inserted.length
    }

    return apiSuccess({ imported: results })
  } catch (err) {
    console.error('[import-data] POST error:', err)
    return apiError('Internal server error', 500)
  }
}
