/**
 * Shared API helpers for authentication and request validation.
 * Uses the standardized response format from api-response.ts.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Authenticate the current request and return the local DB user.
 * Returns an error response if not authenticated.
 */
export async function getAuthenticatedUser() {
  const session = await auth()
  if (!session?.user?.id) {
    return { user: null, error: apiError('Unauthorized', 401) }
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.cognitoSub, session.user.id))
    .limit(1)

  if (!dbUser) {
    return { user: null, error: apiError('Unauthorized', 401) }
  }

  return { user: dbUser, error: null }
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
