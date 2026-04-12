import { getAuthenticatedUser, validateBody } from '@/lib/api-helpers'
import { apiSuccess, apiError } from '@/lib/api-response'
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
  try {
    const { user, supabase, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid or missing request body', 400)
    }

    const { data: parsed, error: valError } = validateBody(importSchema, body)
    if (valError) return valError

    const { data: profile } = await supabase.from('care_profiles').select('id').eq('user_id', user.id).single()
    if (!profile) return apiError('No profile found', 404)

    const results = { medications: 0, appointments: 0, lab_results: 0 }

    if (parsed.medications?.length) {
      const { data } = await supabase.from('medications').insert(
        parsed.medications.map(m => ({ ...m, care_profile_id: profile.id }))
      ).select()
      results.medications = data?.length || 0
    }

    if (parsed.appointments?.length) {
      const { data } = await supabase.from('appointments').insert(
        parsed.appointments.map(a => ({ ...a, care_profile_id: profile.id }))
      ).select()
      results.appointments = data?.length || 0
    }

    if (parsed.lab_results?.length) {
      const { data } = await supabase.from('lab_results').insert(
        parsed.lab_results.map(l => ({ ...l, user_id: user.id }))
      ).select()
      results.lab_results = data?.length || 0
    }

    return apiSuccess({ imported: results })
  } catch (err) {
    console.error('[import-data] POST error:', err)
    return apiError('Internal server error', 500)
  }
}
