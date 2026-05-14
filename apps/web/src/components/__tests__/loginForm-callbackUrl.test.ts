import { describe, it, expect } from 'vitest'

describe('LoginForm signup link href logic', () => {
  function buildSignupHref(safeCallback: string): string {
    return safeCallback !== '/dashboard'
      ? `/signup?callbackUrl=${encodeURIComponent(safeCallback)}`
      : '/signup'
  }

  it('returns plain /signup when safeCallback is default /dashboard', () => {
    expect(buildSignupHref('/dashboard')).toBe('/signup')
  })

  it('includes callbackUrl when invite accept path present', () => {
    const href = buildSignupHref('/care-team?accept=abc-123')
    expect(href).toBe('/signup?callbackUrl=%2Fcare-team%3Faccept%3Dabc-123')
  })

  it('includes callbackUrl for any non-default path', () => {
    const href = buildSignupHref('/settings')
    expect(href).toBe('/signup?callbackUrl=%2Fsettings')
  })
})
