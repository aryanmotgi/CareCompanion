import { signIn } from '@/lib/auth'

export async function POST(req: Request) {
  const formData = await req.formData()
  const consent = formData.get('consent')
  const provider = formData.get('provider') as string | null
  const email = formData.get('email') as string | null

  // Consent is required when signing up (consent field is 'true' for sign-in flows)
  if (consent !== 'true') {
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=consent_required', 302)
  }

  try {
    // Pass identity_provider hint to Cognito when signing in with Google
    const authorizationParams: Record<string, string> = {}
    if (provider === 'google') {
      authorizationParams.identity_provider = 'Google'
    } else if (email) {
      authorizationParams.login_hint = email
    }

    return await signIn('cognito', { redirectTo: '/dashboard' }, authorizationParams)
  } catch (err) {
    // Auth.js throws a non-Error NEXT_REDIRECT when redirecting to the OAuth provider.
    // Must re-throw it — swallowing it blocks the OAuth redirect entirely.
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=signin_failed', 302)
  }
}
