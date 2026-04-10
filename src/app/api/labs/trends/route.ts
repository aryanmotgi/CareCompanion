/**
 * Lab trend analysis endpoint.
 * Returns trend analysis for all recent lab results with alerts and predictions.
 */
import { createClient } from '@/lib/supabase/server'
import { analyzeAllTrends } from '@/lib/lab-trends'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ApiErrors.unauthorized()

    const { data: labResults } = await supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('date_taken', { ascending: false })
      .limit(100)

    if (!labResults || labResults.length === 0) {
      return apiSuccess({
        trends: [],
        red_flags: [],
        overall_status: 'good',
        message: 'No lab results to analyze. Add lab results to get trend insights.',
      })
    }

    const analysis = analyzeAllTrends(labResults)

    return apiSuccess({
      ...analysis,
      total_results_analyzed: labResults.length,
      message: analysis.red_flags.length > 0
        ? `Found ${analysis.red_flags.length} red flag combination(s). Review with your oncology team.`
        : `Analyzed ${analysis.trends.length} lab tests. Overall status: ${analysis.overall_status}.`,
    })
  } catch (error) {
    console.error('[lab-trends] Error:', error)
    return ApiErrors.internal()
  }
}
