/**
 * Shared API helpers for authentication and request validation.
 * Uses the standardized response format from api-response.ts.
 */
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { apiError } from '@/lib/api-response'
import { z } from 'zod'
import { jwtVerify } from 'jose'

/**
 * Authenticate the current request and return the local DB user.
 * Accepts NextAuth session cookies (web) or Authorization: Bearer <jwt> (mobile).
 */
export async function getAuthenticatedUser() {
  // Try NextAuth session cookie first (web app)
  const session = await auth()
  if (session?.user?.id) {
    const userEmail = session.user.email
    if (!userEmail) return { user: null, error: apiError('Unauthorized', 401) }

    const [dbUser] = await db.select().from(users).where(eq(users.email, userEmail)).limit(1)
    if (!dbUser) return { user: null, error: apiError('Unauthorized', 401) }
    return { user: dbUser, error: null }
  }

  // Fall back to Authorization: Bearer <token> (mobile app)
  const headersList = await headers()
  const authHeader = headersList.get('authorization') ?? headersList.get('Authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearer) {
    try {
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
      const { payload } = await jwtVerify(bearer, secret)
      const userId = (payload.id ?? payload.sub) as string | undefined
      if (!userId) return { user: null, error: apiError('Unauthorized', 401) }

      const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      if (!dbUser) return { user: null, error: apiError('Unauthorized', 401) }
      return { user: dbUser, error: null }
    } catch {
      return { user: null, error: apiError('Unauthorized', 401) }
    }
  }

  return { user: null, error: apiError('Unauthorized', 401) }
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

/**
 * Safely parse a JSON request body.
 * Returns { body } on success or { error: Response } with 400 on malformed JSON.
 */
export async function parseBody<T = Record<string, unknown>>(
  req: Request
): Promise<{ body: T; error?: undefined } | { body?: undefined; error: NextResponse }> {
  try {
    const body = (await req.json()) as T;
    return { body };
  } catch {
    return {
      error: NextResponse.json({ error: 'Invalid or missing JSON body' }, { status: 400 }),
    };
  }
}
