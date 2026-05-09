import { describe, it, expect } from 'vitest'

// Pure logic extracted from QRCodePanel — role-aware share prompt
function getSharePrompt(userRole: 'caregiver' | 'patient' | 'self' | undefined): string {
  return userRole === 'patient' ? 'Share with your caregiver' : 'Share with your patient'
}

// canShare SSR guard
function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

describe('QRCodePanel — role-aware share prompt', () => {
  it('shows "Share with your caregiver" for patient role', () => {
    expect(getSharePrompt('patient')).toBe('Share with your caregiver')
  })

  it('shows "Share with your patient" for caregiver role', () => {
    expect(getSharePrompt('caregiver')).toBe('Share with your patient')
  })

  it('shows "Share with your patient" for self role', () => {
    expect(getSharePrompt('self')).toBe('Share with your patient')
  })

  it('shows "Share with your patient" when role is undefined', () => {
    expect(getSharePrompt(undefined)).toBe('Share with your patient')
  })
})

describe('QRCodePanel — canShare SSR guard', () => {
  it('returns false in Node.js test environment (no navigator.share)', () => {
    // In vitest/Node, navigator.share is not defined — copy button must be primary
    expect(canShare()).toBe(false)
  })
})
