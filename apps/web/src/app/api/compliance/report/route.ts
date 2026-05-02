/**
 * Medication compliance report endpoint.
 * Returns adherence stats, streaks, and per-medication breakdown.
 */
export const dynamic = 'force-dynamic'
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { generateComplianceReport } from '@/lib/compliance-tracker'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const url = new URL(req.url)
    const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 90)

    const report = await generateComplianceReport(dbUser!.id, days)

    return apiSuccess(report)
  } catch (error) {
    console.error('[compliance] Error:', error)
    return ApiErrors.internal()
  }
}
