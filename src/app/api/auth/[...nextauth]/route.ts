import { handlers } from '@/lib/auth'

const { GET: _GET, POST } = handlers

export async function GET(req: Request) {
  const url = new URL(req.url)
  // Log raw callback params so we can see exactly what Cognito sends back
  if (url.pathname.includes('/callback/')) {
    const entries = Object.fromEntries(url.searchParams.entries())
    console.log('[auth][callback-raw]', JSON.stringify(entries))
  }
  return _GET(req)
}

export { POST }
