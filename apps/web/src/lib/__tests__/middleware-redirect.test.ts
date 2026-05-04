// Regression: ISSUE-AUTH-002 — open redirect via //evil.com callbackUrl
// middleware.ts line 90: cb.startsWith('/') allows //evil.com (protocol-relative redirect)
// Fixed: added !cb.startsWith('//') guard
// Found by /security-review on 2026-05-02

import { describe, it, expect } from 'vitest'

// Extracted logic from middleware.ts:90 — the callbackUrl resolution guard
function resolveCallbackUrl(cb: string | null): string {
  return cb && cb.startsWith('/') && !cb.startsWith('//') && !cb.startsWith('/\\') ? cb : '/dashboard'
}

describe('middleware callbackUrl open-redirect guard', () => {
  it('allows valid relative paths', () => {
    expect(resolveCallbackUrl('/dashboard')).toBe('/dashboard')
    expect(resolveCallbackUrl('/settings')).toBe('/settings')
    expect(resolveCallbackUrl('/care?tab=meds')).toBe('/care?tab=meds')
  })

  it('blocks protocol-relative URLs (//evil.com attack vector)', () => {
    expect(resolveCallbackUrl('//evil.com')).toBe('/dashboard')
    expect(resolveCallbackUrl('//evil.com/steal-tokens')).toBe('/dashboard')
  })

  it('blocks backslash-relative URLs (/\\evil.com browser normalization)', () => {
    expect(resolveCallbackUrl('/\\evil.com')).toBe('/dashboard')
    expect(resolveCallbackUrl('/\\\\evil.com')).toBe('/dashboard')
  })

  it('blocks absolute URLs', () => {
    expect(resolveCallbackUrl('https://evil.com')).toBe('/dashboard')
    expect(resolveCallbackUrl('http://evil.com')).toBe('/dashboard')
  })

  it('falls back to /dashboard for null or empty callbackUrl', () => {
    expect(resolveCallbackUrl(null)).toBe('/dashboard')
    expect(resolveCallbackUrl('')).toBe('/dashboard')
  })
})
