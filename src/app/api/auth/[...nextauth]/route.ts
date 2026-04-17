import { handlers } from '@/lib/auth'

const { GET: _GET, POST } = handlers

export async function GET(req: Request, ctx: { params: Promise<{ nextauth: string[] }> }) {
  const params = await ctx.params
  // Log raw callback params so we can see exactly what Cognito sends back
  if (params.nextauth?.includes('callback')) {
    const url = new URL(req.url)
    const entries = Object.fromEntries(url.searchParams.entries())
    console.log('[auth][callback-raw]', JSON.stringify(entries))
  }
  return _GET(req, ctx)
}

export { POST }
