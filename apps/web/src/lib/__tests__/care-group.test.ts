import { describe, it, expect } from 'vitest'
import {
  generateCode,
  formatCodeForDisplay,
  normalizeCode,
  DEFAULT_CAREGIVER_PERMS,
  DEFAULT_PATIENT_PERMS,
} from '@/lib/care-group'

describe('care-group code generation', () => {
  it('generates 5-character codes from the safe alphabet', () => {
    const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (let i = 0; i < 100; i++) {
      const code = generateCode()
      expect(code).toHaveLength(5)
      for (const ch of code) {
        expect(alphabet).toContain(ch)
      }
    }
  })

  it('never emits visually ambiguous characters', () => {
    const ambiguous = ['0', 'O', '1', 'I', 'L', 'U']
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      for (const ch of ambiguous) {
        expect(code).not.toContain(ch)
      }
    }
  })

  it('produces a reasonably uniform distribution', () => {
    // Crude sanity check: in 5000 chars across 1000 codes, each of 29 letters
    // appears at least once. (Strict uniformity isn't testable cheaply, but
    // total absence of a letter would indicate a generator bug.)
    const counts = new Map<string, number>()
    for (let i = 0; i < 1000; i++) {
      for (const ch of generateCode()) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1)
      }
    }
    const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ'
    for (const ch of alphabet) {
      expect(counts.get(ch) ?? 0).toBeGreaterThan(0)
    }
  })
})

describe('formatCodeForDisplay', () => {
  it('inserts a hyphen after the 2nd character', () => {
    expect(formatCodeForDisplay('AK7QM')).toBe('AK-7QM')
  })

  it('returns the input unchanged if it is not 5 chars', () => {
    expect(formatCodeForDisplay('AK7Q')).toBe('AK7Q')
    expect(formatCodeForDisplay('AK7QMX')).toBe('AK7QMX')
  })
})

describe('normalizeCode', () => {
  it('upper-cases and strips hyphens', () => {
    expect(normalizeCode('ak-7qm')).toBe('AK7QM')
    expect(normalizeCode('AK-7QM')).toBe('AK7QM')
    expect(normalizeCode('AK 7QM')).toBe('AK7QM')
  })

  it('returns null for wrong length', () => {
    expect(normalizeCode('AK7Q')).toBeNull()
    expect(normalizeCode('AK7QMX')).toBeNull()
    expect(normalizeCode('')).toBeNull()
  })

  it('returns null for characters outside the safe alphabet', () => {
    // Ambiguous chars should be rejected (a user typed them by mistake — better
    // to surface as invalid than silently coerce to something else)
    expect(normalizeCode('AK0QM')).toBeNull()   // 0
    expect(normalizeCode('AKOQM')).toBeNull()   // O
    expect(normalizeCode('AK1QM')).toBeNull()   // 1
    expect(normalizeCode('AKIQM')).toBeNull()   // I
    expect(normalizeCode('AKLQM')).toBeNull()   // L
    expect(normalizeCode('AKUQM')).toBeNull()   // U
  })
})

describe('default permission sets', () => {
  it('caregivers cannot edit appointments by default', () => {
    expect(DEFAULT_CAREGIVER_PERMS.can_edit_appts).toBe(false)
  })

  it('caregivers can read by default', () => {
    expect(DEFAULT_CAREGIVER_PERMS.can_read_meds).toBe(true)
    expect(DEFAULT_CAREGIVER_PERMS.can_read_appts).toBe(true)
    expect(DEFAULT_CAREGIVER_PERMS.can_read_labs).toBe(true)
  })

  it('patients have full permissions', () => {
    expect(DEFAULT_PATIENT_PERMS.can_edit_appts).toBe(true)
    expect(DEFAULT_PATIENT_PERMS.can_chat).toBe(true)
  })
})
