import { signIn } from '@/lib/auth'

export async function POST(req: Request) {
  const formData = await req.formData()
  const consent = formData.get('consent')

  if (consent !== 'true') {
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=consent_required', 302)
  }

  try {
    const referer = req.headers.get('referer') ?? ''
    let redirectTo = '/dashboard'
    try {
      const refUrl = new URL(referer)
      const cb = refUrl.searchParams.get('callbackUrl')
      if (cb && cb.startsWith('/')) redirectTo = cb
    } catch { /* ignore invalid referer */ }
    return await signIn('google', { redirectTo })
  } catch (err) {
    if ((err as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err
    const url = new URL(req.url)
    return Response.redirect(url.origin + '/login?error=signin_failed', 302)
  }
}
