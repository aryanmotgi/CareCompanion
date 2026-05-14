import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { rateLimit } from '@/lib/rate-limit'
import { verifyCareGroupCredentials } from '@/lib/care-group-auth'

const careGroupLimiter = rateLimit({ interval: 60 * 60 * 1000, maxRequests: 5 })

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-real-ip')?.trim() ?? req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? '127.0.0.1'

    // Parse body first so we can include groupName in the rate limit key.
    // This prevents a single IP exhausting attempts on one group and then
    // switching IPs to attempt a different group.
    const { groupName, groupPassword } = await req.json() as { groupName: string; groupPassword: string }

    if (!groupName?.trim() || !groupPassword) {
      return NextResponse.json({ error: 'Group name and password required' }, { status: 400 })
    }

    // Rate-limit keyed on both IP and group name so attackers cannot bypass by
    // cycling IPs or by targeting a single group from many IPs simultaneously.
    const { success } = await careGroupLimiter.check(`mobile-care-group-login:${ip}:${groupName.trim().toLowerCase()}`)
    if (!success) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
    }

    const result = await verifyCareGroupCredentials(groupName, groupPassword)
    if (!result.ok) {
      if (result.reason === 'no_owner' || result.reason === 'no_user') {
        return NextResponse.json({ error: 'Care Group has no owner' }, { status: 500 })
      }
      return NextResponse.json({ error: 'Invalid Care Group name or password' }, { status: 401 })
    }

    const { user: ownerUser } = result

    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const token = await new SignJWT({
      sub: ownerUser.id,
      id: ownerUser.id,
      email: ownerUser.email ?? '',
      name: ownerUser.displayName ?? ownerUser.email ?? '',
      role: ownerUser.role ?? null,
      displayName: ownerUser.displayName ?? null,
      isDemo: ownerUser.isDemo ?? false,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret)

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[mobile-care-group-login] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
