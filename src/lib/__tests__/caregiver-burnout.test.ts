import { describe, it, expect } from 'vitest'
import { assessBurnout } from '@/lib/caregiver-burnout'
import type { SymptomEntry } from '@/lib/types'

function makeEntry(overrides: Partial<SymptomEntry> = {}): SymptomEntry {
  return {
    id: '1',
    user_id: 'u1',
    care_profile_id: 'p1',
    date: '2026-04-01',
    pain_level: null,
    mood: null,
    sleep_quality: null,
    sleep_hours: null,
    appetite: null,
    energy: null,
    symptoms: [],
    notes: null,
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

describe('caregiver-burnout', () => {
  it('returns low risk with no entries', () => {
    const result = assessBurnout([], 0, null)
    expect(result.risk_level).toBe('low')
    expect(result.score).toBe(0)
  })

  it('detects poor sleep pattern', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ id: String(i), date: `2026-04-0${i + 1}`, sleep_quality: 'poor' })
    )
    const result = assessBurnout(entries, 0, 0)
    expect(result.signals.some(s => s.category === 'sleep')).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('detects low mood', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ id: String(i), date: `2026-04-0${i + 1}`, mood: 'terrible' })
    )
    const result = assessBurnout(entries, 0, 0)
    expect(result.signals.some(s => s.category === 'mood')).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })

  it('detects appointment overload', () => {
    const entries = [makeEntry()]
    const result = assessBurnout(entries, 6, 0)
    expect(result.signals.some(s => s.category === 'overload')).toBe(true)
  })

  it('detects isolation from journal gaps', () => {
    const entries = [makeEntry()]
    const result = assessBurnout(entries, 0, 10)
    expect(result.signals.some(s => s.category === 'isolation')).toBe(true)
  })

  it('rates critical burnout correctly', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({
        id: String(i),
        date: `2026-04-0${(i % 9) + 1}`,
        mood: 'terrible',
        sleep_quality: 'terrible',
        sleep_hours: 3,
        energy: 'very_low',
        pain_level: 8,
      })
    )
    const result = assessBurnout(entries, 7, 0)
    expect(result.risk_level).toBe('critical')
    expect(result.recommendations.length).toBeGreaterThan(0)
  })

  it('provides recommendations based on signals', () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ id: String(i), date: `2026-04-0${i + 1}`, mood: 'bad', sleep_quality: 'poor' })
    )
    const result = assessBurnout(entries, 0, 0)
    expect(result.recommendations.length).toBeGreaterThan(0)
  })
})
