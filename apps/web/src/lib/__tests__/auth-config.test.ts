import { describe, it, expect } from 'vitest'
import { authConfig } from '@/lib/auth.config'
import type { Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

// Extract the session callback directly from authConfig
const sessionCallback = authConfig.callbacks!.session as (args: {
  session: Session
  token: JWT
}) => Session | Promise<Session>

function makeSession(includeUser = true): Session {
  return {
    expires: '2099-01-01',
    user: includeUser ? { name: null, email: null, image: null } : undefined,
  } as unknown as Session
}

function makeToken(fields: Record<string, unknown> = {}): JWT {
  return { sub: 'sub-123', name: 'Token Name', ...fields } as JWT
}

describe('authConfig session callback — token mapping', () => {
  it('sets isDemo=true and role=null for a demo-user token', () => {
    const session = makeSession()
    const token = makeToken({ isDemo: true, role: null })

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.isDemo).toBe(true)
    expect(result.user!.role).toBeNull()
  })

  it('sets isDemo=false and role for a regular user with a role', () => {
    const session = makeSession()
    const token = makeToken({ isDemo: false, role: 'caregiver' })

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.isDemo).toBe(false)
    expect(result.user!.role).toBe('caregiver')
  })

  it('uses token.dbUserId as session.user.id when present', () => {
    const session = makeSession()
    const token = makeToken({ dbUserId: 'db-user-abc', sub: 'sub-fallback' })

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.id).toBe('db-user-abc')
  })

  it('falls back to token.sub for session.user.id when dbUserId is absent', () => {
    const session = makeSession()
    const token = makeToken({ sub: 'sub-only' })
    // no dbUserId on token

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.id).toBe('sub-only')
  })

  it('uses token.displayName as session.user.displayName when present', () => {
    const session = makeSession()
    const token = makeToken({ displayName: 'Custom Name', name: 'Token Name' })

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.displayName).toBe('Custom Name')
  })

  it('falls back to token.name for displayName when token.displayName is absent', () => {
    const session = makeSession()
    const token = makeToken({ name: 'Token Name' })
    // no displayName on token

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.displayName).toBe('Token Name')
  })

  it('returns session unchanged (no crash) when session.user is falsy', () => {
    const session = makeSession(false) // user: undefined
    const token = makeToken({ isDemo: true, role: 'caregiver', dbUserId: 'db-1' })

    const result = sessionCallback({ session, token }) as Session

    expect(result.user).toBeUndefined()
    expect(result.expires).toBe('2099-01-01')
  })

  it('defaults isDemo to false when token.isDemo is undefined', () => {
    const session = makeSession()
    const token = makeToken()
    // isDemo not set on token

    const result = sessionCallback({ session, token }) as Session

    expect(result.user!.isDemo).toBe(false)
  })
})
