import { describe, it, expect } from 'vitest'

// timeAgo — extracted for testing (matches NotificationsView.tsx exactly)
function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// getChatPromptForType — extracted for testing (matches NotificationsView.tsx exactly)
function getChatPromptForType(type: string): string {
  switch (type) {
    case 'refill_overdue':
    case 'refill_soon':
      return 'Help me manage my medication refills'
    case 'appointment_prep':
    case 'appointment_today':
      return 'Help me prepare for my upcoming appointment'
    case 'abnormal_lab':
    case 'lab_result':
      return 'Explain my recent lab results'
    case 'prior_auth_expiring':
      return 'Help me understand my prior authorization status'
    case 'claim_denied':
      return 'Help me understand my insurance claim status'
    case 'low_balance':
      return 'Help me manage my FSA or HSA account'
    default:
      return 'Help me understand my care updates'
  }
}

// inQuietHours — extracted for testing (matches notifications.ts exactly)
function inQuietHours(nowHour: number, nowMinute: number, start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const nowMins = nowHour * 60 + nowMinute
  const startMins = sh * 60 + sm
  const endMins = eh * 60 + em
  return startMins <= endMins
    ? nowMins >= startMins && nowMins < endMins
    : nowMins >= startMins || nowMins < endMins
}

describe('timeAgo', () => {
  it('returns just now for < 1 minute', () => {
    const now = new Date(Date.now() - 30_000).toISOString()
    expect(timeAgo(now)).toBe('just now')
  })

  it('returns Nm ago for < 1 hour', () => {
    const now = new Date(Date.now() - 10 * 60_000).toISOString()
    expect(timeAgo(now)).toBe('10m ago')
  })

  it('returns Nh ago for < 24 hours', () => {
    const now = new Date(Date.now() - 3 * 60 * 60_000).toISOString()
    expect(timeAgo(now)).toBe('3h ago')
  })

  it('returns Nd ago for < 7 days', () => {
    const now = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    expect(timeAgo(now)).toBe('2d ago')
  })

  it('returns date string for >= 7 days', () => {
    const date = new Date(Date.now() - 10 * 24 * 60 * 60_000)
    expect(timeAgo(date.toISOString())).toBe(date.toLocaleDateString())
  })
})

describe('getChatPromptForType', () => {
  it('maps refill types to medication prompt', () => {
    expect(getChatPromptForType('refill_overdue')).toContain('medication')
    expect(getChatPromptForType('refill_soon')).toContain('medication')
  })

  it('maps appointment types to appointment prompt', () => {
    expect(getChatPromptForType('appointment_prep')).toContain('appointment')
    expect(getChatPromptForType('appointment_today')).toContain('appointment')
  })

  it('maps lab types to lab prompt', () => {
    expect(getChatPromptForType('abnormal_lab')).toContain('lab')
    expect(getChatPromptForType('lab_result')).toContain('lab')
  })

  it('maps insurance types correctly', () => {
    expect(getChatPromptForType('prior_auth_expiring')).toContain('prior authorization')
    expect(getChatPromptForType('claim_denied')).toContain('insurance claim')
    expect(getChatPromptForType('low_balance')).toContain('FSA')
  })

  it('returns default for unknown types including cycle types', () => {
    expect(getChatPromptForType('cycle_nadir_warning')).toBe('Help me understand my care updates')
    expect(getChatPromptForType('unknown_type')).toBe('Help me understand my care updates')
  })
})

describe('inQuietHours (midnight crossing)', () => {
  // Normal window: 22:00–07:00 (startMins > endMins → wraps midnight)
  it('returns true when inside midnight-crossing window (before midnight)', () => {
    expect(inQuietHours(23, 0, '22:00', '07:00')).toBe(true)
  })

  it('returns true when inside midnight-crossing window (after midnight)', () => {
    expect(inQuietHours(3, 30, '22:00', '07:00')).toBe(true)
  })

  it('returns false when outside midnight-crossing window', () => {
    expect(inQuietHours(12, 0, '22:00', '07:00')).toBe(false)
  })

  // Normal window: 08:00–20:00 (startMins < endMins → no wrap)
  it('returns true inside non-wrapping window', () => {
    expect(inQuietHours(12, 0, '08:00', '20:00')).toBe(true)
  })

  it('returns false outside non-wrapping window', () => {
    expect(inQuietHours(21, 0, '08:00', '20:00')).toBe(false)
  })

  it('boundary: exactly at start time is inside', () => {
    expect(inQuietHours(22, 0, '22:00', '07:00')).toBe(true)
  })

  it('boundary: exactly at end time is outside', () => {
    expect(inQuietHours(7, 0, '22:00', '07:00')).toBe(false)
  })
})
