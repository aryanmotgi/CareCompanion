import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatRefillCountdown, formatAppointmentDate, daysSince } from '../dates'

// Fix test clock to avoid flakiness near midnight
const FIXED_NOW = new Date('2026-04-20T12:00:00Z')

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(FIXED_NOW) })
afterEach(() => { vi.useRealTimers() })

describe('formatRefillCountdown', () => {
  it('returns "today" when refill date is today', () => {
    expect(formatRefillCountdown('2026-04-20')).toBe('Refill due today')
  })

  it('returns singular when 1 day away', () => {
    expect(formatRefillCountdown('2026-04-21')).toBe('Refill in 1 day')
  })

  it('returns plural when multiple days away', () => {
    expect(formatRefillCountdown('2026-04-23')).toBe('Refill in 3 days')
  })

  it('returns overdue for past dates', () => {
    expect(formatRefillCountdown('2026-04-18')).toBe('Refill overdue by 2 days')
  })

  it('returns empty string for null', () => {
    expect(formatRefillCountdown(null)).toBe('')
  })
})

describe('daysSince', () => {
  it('returns 0 for today', () => {
    expect(daysSince('2026-04-20T10:00:00Z')).toBe(0)
  })

  it('returns correct count for past dates', () => {
    expect(daysSince('2026-04-18T10:00:00Z')).toBe(2)
  })
})
