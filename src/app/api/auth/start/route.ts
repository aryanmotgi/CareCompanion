import { signIn } from '@/lib/auth'

export async function POST(req: Request) {
  const formData = await req.formData()
  const consent = formData.get('consent')

  if (consent !== 'true') {
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=consent_required', 302)
  }

  try {
    return await signIn('google', { redirectTo: '/dashboard' })
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=signin_failed', 302)
  }
}
