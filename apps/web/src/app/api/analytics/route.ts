import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'
import { trackEvent } from '@/lib/analytics'

const limiter = rateLimit({ interval: 60_000, uniqueTokenPerInterval: 5000, maxRequests: 60 })

interface Body {
  eventName?: unknown
  sessionId?: unknown
  properties?: unknown
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  const { user, error: authError } = await getAuthenticatedUser()
  if (authError) return authError

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return apiError('Invalid JSON', 400)
  }

  const eventName = typeof body.eventName === 'string' ? body.eventName : null
  if (!eventName || eventName.length === 0 || eventName.length > 128) {
    return apiError('Invalid eventName', 400)
  }

  const sessionId = typeof body.sessionId === 'string' && body.sessionId.length <= 128 ? body.sessionId : null
  const properties = body.properties && typeof body.properties === 'object' && !Array.isArray(body.properties)
    ? (body.properties as Record<string, unknown>)
    : {}

  await trackEvent({ eventName, userId: user.id, sessionId, properties })
  return apiSuccess({ ok: true })
}
