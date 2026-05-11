import { describe, it, expect } from 'vitest'

// ── Pure logic inlined from CareHubView (private fns) ─────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date()
  const target = new Date(dateStr)
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / 86400000)
}

type Appt = { specialty?: string; purpose?: string; doctorName?: string }
function isChemoAppointment(appt: Appt): boolean {
  const keywords = ['chemo', 'infusion', 'herceptin', 'perjeta', 'taxotere', 'oncol', 'carboplatin', 'taxol', 'cytoxan']
  const text = [appt.specialty, appt.purpose, appt.doctorName].filter(Boolean).join(' ').toLowerCase()
  return keywords.some(k => text.includes(k))
}

function currentWeekNumber(): number {
  const d = new Date()
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7)
}

type Checkin = { pain: number; mood: number }
function getStatusBadge(checkin: Checkin | null): { label: string; className: string } {
  if (!checkin) return { label: 'No Check-in', className: 'bg-white/[0.06] text-[var(--text-muted)]' }
  const { pain, mood } = checkin
  if (pain >= 7 || mood <= 1) return { label: 'Needs Attention', className: 'bg-red-500/15 text-red-300 border border-red-500/20' }
  if (pain >= 4 || mood <= 2) return { label: 'Watch', className: 'bg-amber-500/15 text-amber-300 border border-amber-500/20' }
  return { label: 'All Clear', className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20' }
}

type Insight = { title: string; body: string }
function extractClinicalAlerts(insights: Insight[]): string[] {
  const keys: string[] = []
  const hasNadir = insights.some(i => {
    const t = `${i.title} ${i.body}`.toLowerCase()
    return t.includes('nadir') || t.includes('neutrophil') || t.includes('wbc') || t.includes('anc')
  })
  if (hasNadir) keys.push('nadir')
  const hasAuth = insights.some(i => {
    const t = `${i.title} ${i.body}`.toLowerCase()
    return t.includes('prior auth') || t.includes('authorization') || t.includes('auth expir')
  })
  if (hasAuth) keys.push('auth')
  const hasRefill = insights.some(i => {
    const t = `${i.title} ${i.body}`.toLowerCase()
    return t.includes('refill') && (t.includes('day') || t.includes('due'))
  })
  if (hasRefill) keys.push('refill')
  return keys
}

// ─────────────────────────────────────────────────────────────────────────────

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString()
    expect(daysUntil(today)).toBe(0)
  })

  it('returns 1 for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    expect(daysUntil(tomorrow.toISOString())).toBe(1)
  })

  it('returns 7 for one week away', () => {
    const future = new Date()
    future.setDate(future.getDate() + 7)
    expect(daysUntil(future.toISOString())).toBe(7)
  })

  it('returns negative for past dates', () => {
    const past = new Date()
    past.setDate(past.getDate() - 3)
    expect(daysUntil(past.toISOString())).toBe(-3)
  })
})

describe('isChemoAppointment', () => {
  it('matches "chemo" in specialty', () => {
    expect(isChemoAppointment({ specialty: 'Chemotherapy' })).toBe(true)
  })

  it('matches "infusion" in purpose', () => {
    expect(isChemoAppointment({ purpose: 'IV infusion session' })).toBe(true)
  })

  it('matches "oncol" in specialty (partial, oncology)', () => {
    expect(isChemoAppointment({ specialty: 'Oncology' })).toBe(true)
  })

  it('matches "taxol" in doctorName field (edge case)', () => {
    expect(isChemoAppointment({ doctorName: 'Dr. Taxol Specialist' })).toBe(true)
  })

  it('matches herceptin, carboplatin, cytoxan', () => {
    expect(isChemoAppointment({ purpose: 'Herceptin' })).toBe(true)
    expect(isChemoAppointment({ purpose: 'Carboplatin cycle' })).toBe(true)
    expect(isChemoAppointment({ purpose: 'Cytoxan administration' })).toBe(true)
  })

  it('returns false for non-chemo appointments', () => {
    expect(isChemoAppointment({ specialty: 'Cardiology', purpose: 'Annual physical', doctorName: 'Dr. Smith' })).toBe(false)
  })

  it('returns false for empty appointment', () => {
    expect(isChemoAppointment({})).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isChemoAppointment({ specialty: 'CHEMO' })).toBe(true)
    expect(isChemoAppointment({ purpose: 'INFUSION CENTER' })).toBe(true)
  })
})

describe('currentWeekNumber', () => {
  it('returns a number between 1 and 53', () => {
    const week = currentWeekNumber()
    expect(week).toBeGreaterThanOrEqual(1)
    expect(week).toBeLessThanOrEqual(53)
  })

  it('returns the same value when called twice in the same instant', () => {
    expect(currentWeekNumber()).toBe(currentWeekNumber())
  })
})

describe('getStatusBadge', () => {
  it('returns No Check-in when checkin is null', () => {
    expect(getStatusBadge(null).label).toBe('No Check-in')
  })

  it('returns Needs Attention when pain >= 7', () => {
    expect(getStatusBadge({ pain: 7, mood: 3 }).label).toBe('Needs Attention')
    expect(getStatusBadge({ pain: 10, mood: 3 }).label).toBe('Needs Attention')
  })

  it('returns Needs Attention when mood <= 1', () => {
    expect(getStatusBadge({ pain: 2, mood: 1 }).label).toBe('Needs Attention')
    expect(getStatusBadge({ pain: 2, mood: 0 }).label).toBe('Needs Attention')
  })

  it('returns Watch when pain >= 4', () => {
    expect(getStatusBadge({ pain: 4, mood: 3 }).label).toBe('Watch')
    expect(getStatusBadge({ pain: 6, mood: 3 }).label).toBe('Watch')
  })

  it('returns Watch when mood <= 2 (and pain < 7)', () => {
    expect(getStatusBadge({ pain: 3, mood: 2 }).label).toBe('Watch')
  })

  it('returns All Clear for good vitals', () => {
    expect(getStatusBadge({ pain: 1, mood: 4 }).label).toBe('All Clear')
    expect(getStatusBadge({ pain: 0, mood: 5 }).label).toBe('All Clear')
  })
})

describe('ClinicalAlertsSection keyword matching', () => {
  const insight = (title: string, body: string): Insight => ({ title, body })

  it('detects nadir by keyword in title', () => {
    expect(extractClinicalAlerts([insight('Nadir period warning', '')])).toContain('nadir')
  })

  it('detects nadir via wbc keyword in body', () => {
    expect(extractClinicalAlerts([insight('Lab result', 'WBC count low')])).toContain('nadir')
  })

  it('detects nadir via anc keyword', () => {
    expect(extractClinicalAlerts([insight('Alert', 'ANC below threshold')])).toContain('nadir')
  })

  it('detects authorization/prior auth', () => {
    expect(extractClinicalAlerts([insight('Prior auth needed', 'approval pending')])).toContain('auth')
    expect(extractClinicalAlerts([insight('Alert', 'authorization expires next week')])).toContain('auth')
  })

  it('detects refill with day context', () => {
    expect(extractClinicalAlerts([insight('Refill due in 3 days', '')])).toContain('refill')
    expect(extractClinicalAlerts([insight('Medication refill', '5 days remaining')])).toContain('refill')
  })

  it('does NOT match refill without day/due qualifier', () => {
    expect(extractClinicalAlerts([insight('Refill submitted', 'pharmacy notified')])).not.toContain('refill')
  })

  it('returns empty array for irrelevant insights', () => {
    expect(extractClinicalAlerts([insight('Weather update', 'Sunny today')])).toHaveLength(0)
  })

  it('returns multiple alerts when multiple match', () => {
    const alerts = extractClinicalAlerts([
      insight('Nadir warning', 'neutrophil low'),
      insight('Refill in 2 days', ''),
    ])
    expect(alerts).toContain('nadir')
    expect(alerts).toContain('refill')
  })
})
