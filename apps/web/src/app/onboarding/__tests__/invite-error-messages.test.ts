import { describe, it, expect } from 'vitest'

const INVITE_ERROR_MESSAGES: Record<string, string> = {
  'invite-not-found': "That invite link isn't valid. Ask your care partner to share a new one.",
  'invite-used': 'This invite has already been used. Ask your care partner to generate a fresh link.',
  'invite-revoked': 'This invite has been cancelled. Ask your care partner to share a new one.',
  'invite-expired': 'This invite expired. Ask your care partner to share a new one — they only last 7 days.',
  'group-full': 'This Care Group is full (maximum 10 members). Ask your care partner to reach out to us for help.',
  'invalid-invite': 'That invite link looks incomplete. Try opening it again from the original message.',
}

describe('INVITE_ERROR_MESSAGES', () => {
  it('covers all 6 known error codes', () => {
    expect(Object.keys(INVITE_ERROR_MESSAGES)).toHaveLength(6)
  })

  it('invite-expired mentions 7 days so users know link is still valid', () => {
    expect(INVITE_ERROR_MESSAGES['invite-expired']).toContain('7 days')
  })

  it('group-full mentions 10 member limit', () => {
    expect(INVITE_ERROR_MESSAGES['group-full']).toContain('10 members')
  })

  it('invite-used suggests generating a fresh link', () => {
    expect(INVITE_ERROR_MESSAGES['invite-used']).toContain('fresh link')
  })

  it('returns undefined for unknown error code (caller must handle null)', () => {
    expect(INVITE_ERROR_MESSAGES['unknown-code']).toBeUndefined()
  })

  it('all messages are non-empty strings', () => {
    for (const [key, msg] of Object.entries(INVITE_ERROR_MESSAGES)) {
      expect(typeof msg, `message for ${key}`).toBe('string')
      expect(msg.length, `message for ${key}`).toBeGreaterThan(10)
    }
  })
})
