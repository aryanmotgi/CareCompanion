import { getAuthenticatedUser } from '@/lib/api-helpers'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api-response'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { users } from '@/lib/db/schema'
import { rateLimit } from '@/lib/rate-limit'
import { logAudit } from '@/lib/audit'
import { validateCsrf } from '@/lib/csrf'
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider'

const limiter = rateLimit({ interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 5 })

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(req: Request) {
  const { valid, error: csrfError } = await validateCsrf(req)
  if (!valid) return csrfError!

  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await limiter.check(ip)
  if (!success) return ApiErrors.rateLimited()

  try {
    const { user, error: authError } = await getAuthenticatedUser()
    if (authError) return authError

    await logAudit({
      user_id: user.id,
      action: 'delete_account',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    console.log(`[delete-account] Starting account deletion for user ${user.id}`)

    // Delete the user record from DB (cascades to all related records via FK constraints)
    await db.delete(users).where(eq(users.cognitoSub, user.id))

    console.log(`[delete-account] DB records deleted for user ${user.id}`)

    // Delete the Cognito user so they cannot log back in and recreate the DB record
    if (process.env.COGNITO_USER_POOL_ID) {
      try {
        await cognitoClient.send(new AdminDeleteUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID,
          Username: user.id, // cognitoSub is the Cognito username/sub
        }))
        console.log(`[delete-account] Cognito user deleted: ${user.id}`)
      } catch (cognitoError) {
        // Non-fatal: DB data is gone, log but don't block the response.
        // The account is effectively unusable even if Cognito auth shell persists.
        console.error('[delete-account] Cognito deletion failed (non-fatal):', cognitoError)
      }
    } else {
      console.warn('[delete-account] COGNITO_USER_POOL_ID not set — skipping Cognito user deletion')
    }

    console.log(`[delete-account] Successfully completed deletion for user ${user.id}`)
    return apiSuccess({ success: true })
  } catch (error) {
    console.error('[delete-account] Error:', error)
    return apiError('Internal server error', 500)
  }
}
