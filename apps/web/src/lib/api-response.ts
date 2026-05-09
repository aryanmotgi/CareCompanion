/**
 * Standardized API response helpers.
 * Every API route should use these instead of raw NextResponse.json().
 */
import { NextResponse } from 'next/server'

interface ApiSuccessResponse<T = unknown> {
  ok: true
  data: T
}

interface ApiErrorResponse {
  ok: false
  error: string
  code?: string
  details?: unknown
}

type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Return a successful response with typed data.
 */
export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status })
}

/**
 * Return an error response with a message and optional error code.
 */
export function apiError(
  error: string,
  status = 400,
  opts?: { code?: string; details?: unknown }
): NextResponse<ApiResponse<never>> {
  const body = {
    ok: false as const,
    error,
    ...(opts?.code ? { code: opts.code } : {}),
    ...(opts?.details ? { details: opts.details } : {}),
  }
  return NextResponse.json(body, { status })
}

/**
 * Common error responses.
 */
export const ApiErrors = {
  unauthorized: () => apiError('Not authenticated', 401, { code: 'UNAUTHORIZED' }),
  forbidden: () => apiError('Forbidden', 403, { code: 'FORBIDDEN' }),
  notFound: (resource = 'Resource') => apiError(`${resource} not found`, 404, { code: 'NOT_FOUND' }),
  rateLimited: (retryAfterMs?: number) =>
    apiError('Too many requests', 429, { code: 'RATE_LIMITED', details: retryAfterMs ? { retry_after_ms: retryAfterMs } : undefined }),
  badRequest: (message: string) => apiError(message, 400, { code: 'BAD_REQUEST' }),
  internal: (message = 'Internal server error') => apiError(message, 500, { code: 'INTERNAL_ERROR' }),
  methodNotAllowed: () => apiError('Method not allowed', 405, { code: 'METHOD_NOT_ALLOWED' }),
}
