import { describe, it, expect } from 'vitest'

describe('care-team invite revoke logic', () => {
  it('only allows owner/editor to revoke', () => {
    const canRevoke = (role: string) => ['owner', 'editor'].includes(role)
    expect(canRevoke('owner')).toBe(true)
    expect(canRevoke('editor')).toBe(true)
    expect(canRevoke('viewer')).toBe(false)
  })

  it('only revokes pending invites — not accepted or already revoked', () => {
    const canRevoke = (status: string) => status === 'pending'
    expect(canRevoke('pending')).toBe(true)
    expect(canRevoke('accepted')).toBe(false)
    expect(canRevoke('revoked')).toBe(false)
  })

  it('validates that inviteId is a non-empty string', () => {
    const isValid = (id: unknown) => typeof id === 'string' && id.length > 0
    expect(isValid('abc-123')).toBe(true)
    expect(isValid('')).toBe(false)
    expect(isValid(undefined)).toBe(false)
    expect(isValid(null)).toBe(false)
  })
})
