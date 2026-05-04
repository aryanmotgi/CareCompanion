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
  region: process.env.AWS_REGION!,
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

    console.log(`[delete-account] Starting account deletion for user ${user.id}`)

    // Audit before delete so the record exists if the write fails
    await logAudit({
      user_id: user.id,
      action: 'delete_account',
      ip_address: req.headers.get('x-forwarded-for') || undefined,
    })

    // Delete the user record (cascades to all related records via FK constraints)
    await db.delete(users).where(eq(users.id, user.id))

    // Delete from Cognito — use providerSub (cognito_sub column = Cognito UUID username)
    // Falls back to email for users who signed up before cognito_sub was stored
    const cognitoUsername = user.providerSub ?? user.email
    try {
      await cognitoClient.send(new AdminDeleteUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: cognitoUsername,
      }));
    } catch (cognitoErr) {
      console.error(`[delete-account] Cognito deletion failed for username "${cognitoUsername}" (DB record already deleted):`, cognitoErr);
      // Non-blocking — DB record is gone, user cannot log back in via DB lookup
    }

    console.log(`[delete-account] Successfully deleted user ${user.id}`)
    return apiSuccess({ success: true })
  } catch (error) {
    console.error('[delete-account] Error:', error)
    return apiError('Internal server error', 500)
  }
}
