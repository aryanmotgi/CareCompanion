/**
 * Shared API helpers for authentication and request validation.
 * Uses the standardized response format from api-response.ts.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Authenticate the current request and return the user + supabase client.
 * Returns an error response if not authenticated.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { user: null, supabase, error: apiError('Unauthorized', 401) }
  }
  return { user, supabase, error: null }
}

/**
 * Validate a request body against a Zod schema.
 * Returns the parsed data or an error response with validation details.
 */
export function validateBody<T extends z.ZodType>(
  schema: T,
  body: unknown
): { data: z.infer<T>; error: null } | { data: null; error: NextResponse } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join(', ')
    return { data: null, error: apiError('Validation error', 400, { details: message }) }
  }
  return { data: result.data, error: null }
}
