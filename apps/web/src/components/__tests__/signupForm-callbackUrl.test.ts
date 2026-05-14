import { describe, it, expect } from 'vitest'

describe('SignupForm post-signup redirect logic', () => {
  function getRedirectTarget(opts: {
    joinGroup?: string
    joinToken?: string
    callbackUrl?: string
  }): string {
    const { joinGroup, joinToken, callbackUrl } = opts
    if (joinGroup && joinToken) return `/join?group=${joinGroup}&token=${joinToken}`
    if (callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')) return callbackUrl
    return '/onboarding'
  }

  it('prefers joinGroup+joinToken over callbackUrl', () => {
    expect(getRedirectTarget({ joinGroup: 'g1', joinToken: 't1', callbackUrl: '/care-team?accept=x' }))
      .toBe('/join?group=g1&token=t1')
  })

  it('uses callbackUrl when no joinGroup/joinToken', () => {
    expect(getRedirectTarget({ callbackUrl: '/care-team?accept=abc' }))
      .toBe('/care-team?accept=abc')
  })

  it('falls back to /onboarding when nothing present', () => {
    expect(getRedirectTarget({})).toBe('/onboarding')
  })

  it('rejects open-redirect callbackUrl (double slash)', () => {
    expect(getRedirectTarget({ callbackUrl: '//evil.com' })).toBe('/onboarding')
  })
})
