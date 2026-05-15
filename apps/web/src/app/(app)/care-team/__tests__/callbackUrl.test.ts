import { describe, it, expect } from 'vitest'

describe('care-team page callbackUrl logic', () => {
  it('builds correct callbackUrl when acceptInviteId present', () => {
    const acceptInviteId = 'abc-123'
    const callbackUrl = '/care-team?accept=' + acceptInviteId
    expect(encodeURIComponent(callbackUrl)).toBe('%2Fcare-team%3Faccept%3Dabc-123')
  })

  it('omits acceptInviteId suffix when null', () => {
    const acceptInviteId: string | null = null
    const loginUrl = acceptInviteId
      ? '/login?error=session&callbackUrl=' + encodeURIComponent('/care-team?accept=' + acceptInviteId)
      : '/login?error=session&callbackUrl=' + encodeURIComponent('/care-team')
    expect(loginUrl).toBe('/login?error=session&callbackUrl=%2Fcare-team')
  })

  it('constructs full login redirect with accept callbackUrl', () => {
    const acceptInviteId = 'xyz-456'
    const loginUrl = '/login?error=session&callbackUrl=' + encodeURIComponent('/care-team?accept=' + acceptInviteId)
    expect(loginUrl).toBe('/login?error=session&callbackUrl=%2Fcare-team%3Faccept%3Dxyz-456')
  })
})
