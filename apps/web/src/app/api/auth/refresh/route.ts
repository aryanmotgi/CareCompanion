import { NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

    // jwtVerify throws if expired — we intentionally let it reject expired tokens
    const { payload } = await jwtVerify(token, secret)

    const newToken = await new SignJWT({
      sub: payload.sub,
      id: payload.id,
      email: payload.email,
      name: payload.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    return NextResponse.json({ token: newToken })
  } catch (err) {
    console.error('[token-refresh]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Token invalid or expired' }, { status: 401 })
  }
}
