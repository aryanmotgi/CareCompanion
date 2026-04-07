/**
 * Medication compliance report endpoint.
 * Returns adherence stats, streaks, and per-medication breakdown.
 */
import { createClient } from '@/lib/supabase/server'
import { generateComplianceReport } from '@/lib/compliance-tracker'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const url = new URL(req.url)
    const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 90)

    const report = await generateComplianceReport(user.id, days)

    return apiSuccess(report)
  } catch (error) {
    console.error('[compliance] Error:', error)
    return ApiErrors.internal()
  }
}
