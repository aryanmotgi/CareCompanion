import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Pure logic inlined from SymptomRadarCard (private fns) ────────────────────

type CheckinData = { checkedInAt: string }

function hasCheckinToday(checkins: CheckinData[]): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return checkins.some(c => {
    const d = new Date(c.checkedInAt)
    d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  })
}

function lastCheckinLabel(checkins: CheckinData[]): string | null {
  if (checkins.length === 0) return null
  const sorted = [...checkins].sort(
    (a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime()
  )
  const last = sorted[0]
  const diffMs = Date.now() - new Date(last.checkedInAt).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Last check-in: just now'
  if (mins < 60) return `Last check-in: ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Last check-in: ${hours}h ago`
  if (hours < 48) return 'Last check-in: yesterday'
  return `Last check-in: ${Math.floor(hours / 24)}d ago`
}

function getOrbColor(
  metric: 'pain' | 'energy' | 'mood' | 'adherence',
  value: number,
): { bg: string; glow: string } {
  if (metric === 'pain') {
    if (value <= 3) return { bg: '#6EE7B7', glow: 'orb-green' }
    if (value <= 6) return { bg: '#FBBF24', glow: 'orb-amber' }
    return { bg: '#FCA5A5', glow: 'orb-red' }
  }
  if (metric === 'energy') {
    if (value >= 3) return { bg: '#6EE7B7', glow: 'orb-green' }
    if (value >= 2) return { bg: '#FBBF24', glow: 'orb-amber' }
    return { bg: '#FCA5A5', glow: 'orb-red' }
  }
  if (metric === 'mood') {
    if (value >= 4) return { bg: '#6EE7B7', glow: 'orb-green' }
    if (value >= 3) return { bg: '#FBBF24', glow: 'orb-amber' }
    return { bg: '#FCA5A5', glow: 'orb-red' }
  }
  // adherence
  if (value >= 80) return { bg: '#6EE7B7', glow: 'orb-green' }
  if (value >= 50) return { bg: '#FBBF24', glow: 'orb-amber' }
  return { bg: '#FCA5A5', glow: 'orb-red' }
}

// ─────────────────────────────────────────────────────────────────────────────

function checkinAt(offsetMs: number): CheckinData {
  return { checkedInAt: new Date(Date.now() - offsetMs).toISOString() }
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('hasCheckinToday', () => {
  // Pin clock to mid-day so 1h/30min-ago offsets don't cross local midnight.
  beforeEach(() => {
    vi.useFakeTimers()
    const fixed = new Date()
    fixed.setHours(12, 0, 0, 0)
    vi.setSystemTime(fixed)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns false for empty array', () => {
    expect(hasCheckinToday([])).toBe(false)
  })

  it('returns true when checkin is today', () => {
    expect(hasCheckinToday([checkinAt(30 * MIN)])).toBe(true)
  })

  it('returns false when all checkins are yesterday or older', () => {
    expect(hasCheckinToday([checkinAt(25 * HOUR)])).toBe(false)
  })

  it('returns true when at least one checkin is today (mixed)', () => {
    expect(hasCheckinToday([checkinAt(25 * HOUR), checkinAt(1 * HOUR)])).toBe(true)
  })

  it('handles midnight boundary — checkin exactly at start of today counts', () => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    expect(hasCheckinToday([{ checkedInAt: startOfToday.toISOString() }])).toBe(true)
  })
})

describe('lastCheckinLabel', () => {
  it('returns null for empty array', () => {
    expect(lastCheckinLabel([])).toBeNull()
  })

  it('returns "just now" for < 1 minute ago', () => {
    expect(lastCheckinLabel([checkinAt(30_000)])).toBe('Last check-in: just now')
  })

  it('returns Xm ago for < 60 minutes', () => {
    expect(lastCheckinLabel([checkinAt(15 * MIN)])).toBe('Last check-in: 15m ago')
  })

  it('returns Xh ago for < 24 hours', () => {
    expect(lastCheckinLabel([checkinAt(3 * HOUR)])).toBe('Last check-in: 3h ago')
  })

  it('returns "yesterday" for 24–48 hours ago', () => {
    expect(lastCheckinLabel([checkinAt(30 * HOUR)])).toBe('Last check-in: yesterday')
  })

  it('returns Xd ago for > 48 hours', () => {
    expect(lastCheckinLabel([checkinAt(72 * HOUR)])).toBe('Last check-in: 3d ago')
  })

  it('uses the most recent checkin when multiple exist', () => {
    const recent = checkinAt(5 * MIN)
    const old = checkinAt(3 * DAY)
    expect(lastCheckinLabel([old, recent])).toBe('Last check-in: 5m ago')
  })
})

describe('getOrbColor — pain metric', () => {
  it('returns green for pain <= 3', () => {
    expect(getOrbColor('pain', 0).glow).toBe('orb-green')
    expect(getOrbColor('pain', 3).glow).toBe('orb-green')
  })

  it('returns amber for pain 4–6', () => {
    expect(getOrbColor('pain', 4).glow).toBe('orb-amber')
    expect(getOrbColor('pain', 6).glow).toBe('orb-amber')
  })

  it('returns red for pain >= 7', () => {
    expect(getOrbColor('pain', 7).glow).toBe('orb-red')
    expect(getOrbColor('pain', 10).glow).toBe('orb-red')
  })
})

describe('getOrbColor — energy metric', () => {
  it('returns green for energy >= 3', () => {
    expect(getOrbColor('energy', 3).glow).toBe('orb-green')
    expect(getOrbColor('energy', 5).glow).toBe('orb-green')
  })

  it('returns amber for energy == 2', () => {
    expect(getOrbColor('energy', 2).glow).toBe('orb-amber')
  })

  it('returns red for energy <= 1', () => {
    expect(getOrbColor('energy', 1).glow).toBe('orb-red')
    expect(getOrbColor('energy', 0).glow).toBe('orb-red')
  })
})

describe('getOrbColor — mood metric', () => {
  it('returns green for mood >= 4', () => {
    expect(getOrbColor('mood', 4).glow).toBe('orb-green')
    expect(getOrbColor('mood', 5).glow).toBe('orb-green')
  })

  it('returns amber for mood == 3', () => {
    expect(getOrbColor('mood', 3).glow).toBe('orb-amber')
  })

  it('returns red for mood <= 2', () => {
    expect(getOrbColor('mood', 2).glow).toBe('orb-red')
    expect(getOrbColor('mood', 0).glow).toBe('orb-red')
  })
})

describe('getOrbColor — adherence metric', () => {
  it('returns green for adherence >= 80', () => {
    expect(getOrbColor('adherence', 80).glow).toBe('orb-green')
    expect(getOrbColor('adherence', 100).glow).toBe('orb-green')
  })

  it('returns amber for adherence 50–79', () => {
    expect(getOrbColor('adherence', 50).glow).toBe('orb-amber')
    expect(getOrbColor('adherence', 79).glow).toBe('orb-amber')
  })

  it('returns red for adherence < 50', () => {
    expect(getOrbColor('adherence', 49).glow).toBe('orb-red')
    expect(getOrbColor('adherence', 0).glow).toBe('orb-red')
  })
})
