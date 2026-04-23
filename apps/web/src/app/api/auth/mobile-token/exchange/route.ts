import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

// No Redis — code is a short-lived signed JWT. Verify it and return the session token.

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { code?: string }
  if (!body.code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const { payload } = await jwtVerify(body.code, secret)
    const sessionToken = payload.t as string | undefined
    if (!sessionToken) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }
    return NextResponse.json({ sessionToken })
  } catch {
    return NextResponse.json({ error: 'Code expired or invalid' }, { status: 404 })
  }
}
