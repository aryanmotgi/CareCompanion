/**
 * Lab trend analysis endpoint.
 * Returns trend analysis for all recent lab results with alerts and predictions.
 */
import { getAuthenticatedUser } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { labResults } from '@/lib/db/schema'
import { and, eq, isNull, desc } from 'drizzle-orm'
import { analyzeAllTrends } from '@/lib/lab-trends'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user: dbUser, error } = await getAuthenticatedUser()
    if (error) return error

    const labs = await db
      .select()
      .from(labResults)
      .where(and(eq(labResults.userId, dbUser!.id), isNull(labResults.deletedAt)))
      .orderBy(desc(labResults.dateTaken))
      .limit(100)

    if (labs.length === 0) {
      return apiSuccess({
        trends: [],
        red_flags: [],
        overall_status: 'good',
        message: 'No lab results to analyze. Add lab results to get trend insights.',
      })
    }

    const analysis = analyzeAllTrends(labs)

    return apiSuccess({
      ...analysis,
      total_results_analyzed: labs.length,
      message: analysis.red_flags.length > 0
        ? `Found ${analysis.red_flags.length} red flag combination(s). Review with your oncology team.`
        : `Analyzed ${analysis.trends.length} lab tests. Overall status: ${analysis.overall_status}.`,
    })
  } catch (error) {
    console.error('[lab-trends] Error:', error)
    return ApiErrors.internal()
  }
}
