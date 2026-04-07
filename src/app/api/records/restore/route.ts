/**
 * Restore soft-deleted records.
 * POST { table, id } — brings back a deleted record.
 */
import { createClient } from '@/lib/supabase/server'
import { restore } from '@/lib/soft-delete'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { z } from 'zod'

const RestoreSchema = z.object({
  table: z.enum(['medications', 'appointments', 'doctors', 'documents', 'lab_results', 'notifications', 'claims']),
  id: z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const body = await req.json()
    const parsed = RestoreSchema.safeParse(body)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid input: table and id (UUID) required')
    }

    const { data: profile } = await supabase
      .from('care_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const result = await restore(parsed.data.table, parsed.data.id, user.id, profile?.id)
    return apiSuccess(result)
  } catch (error) {
    console.error('[restore] Error:', error)
    return apiError('Failed to restore record', 500)
  }
}
