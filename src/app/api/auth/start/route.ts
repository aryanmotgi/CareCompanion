import { signIn } from '@/lib/auth'

export async function POST(req: Request) {
  const formData = await req.formData()
  const consent = formData.get('consent')

  if (consent !== 'true') {
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=consent_required', 302)
  }

  try {
    return await signIn('cognito', { redirectTo: '/dashboard' })
  } catch (err) {
    // Auth.js throws a non-Error NEXT_REDIRECT when redirecting to the OAuth provider.
    // Must re-throw it — swallowing it blocks the OAuth redirect entirely.
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=signin_failed', 302)
  }
}
