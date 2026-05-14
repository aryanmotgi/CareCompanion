import { describe, it, expect } from 'vitest'
import {
  classifyError,
  classifyStatus,
  formatLastSynced,
  backoffFor,
  isMedicalEvent,
  MEDICAL_KEYWORDS,
  MAX_ATTEMPTS,
  BACKOFF_MS,
} from '../pure'

describe('classifyError', () => {
  it('classifies 401 as reauth', () => {
    const r = classifyError(new Error('API error 401: not signed in'))
    expect(r.cls).toBe('reauth')
    expect(r.status).toBe(401)
  })

  it('classifies 403 as reauth', () => {
    expect(classifyError(new Error('API error 403: forbidden')).cls).toBe('reauth')
  })

  it('classifies 400 as drop', () => {
    expect(classifyError(new Error('API error 400: bad payload')).cls).toBe('drop')
  })

  it('classifies 500 as retry', () => {
    expect(classifyError(new Error('API error 500: server boom')).cls).toBe('retry')
  })

  it('classifies network error (no status) as retry', () => {
    expect(classifyError(new Error('Network request failed')).cls).toBe('retry')
    expect(classifyError(new Error('Network request failed')).status).toBeNull()
  })

  it('accepts non-Error inputs', () => {
    expect(classifyError('boom').cls).toBe('retry')
  })
})

describe('classifyStatus', () => {
  it('401/403 → reauth', () => {
    expect(classifyStatus(401, 'msg').cls).toBe('reauth')
    expect(classifyStatus(403, 'msg').cls).toBe('reauth')
  })

  it('400/404/422 → drop', () => {
    expect(classifyStatus(400, 'msg').cls).toBe('drop')
    expect(classifyStatus(404, 'msg').cls).toBe('drop')
    expect(classifyStatus(422, 'msg').cls).toBe('drop')
  })

  it('5xx → retry', () => {
    expect(classifyStatus(500, 'msg').cls).toBe('retry')
    expect(classifyStatus(502, 'msg').cls).toBe('retry')
  })

  it('null status (network) → retry', () => {
    expect(classifyStatus(null, 'msg').cls).toBe('retry')
  })
})

describe('formatLastSynced', () => {
  const now = 1_000_000_000_000

  it('returns "never" for null', () => {
    expect(formatLastSynced(null, now)).toBe('never')
  })

  it('returns "just now" within 60s', () => {
    expect(formatLastSynced(now - 30_000, now)).toBe('just now')
    expect(formatLastSynced(now - 59_999, now)).toBe('just now')
  })

  it('returns minutes under an hour', () => {
    expect(formatLastSynced(now - 5 * 60_000, now)).toBe('5m ago')
    expect(formatLastSynced(now - 59 * 60_000, now)).toBe('59m ago')
  })

  it('returns hours under a day', () => {
    expect(formatLastSynced(now - 2 * 60 * 60_000, now)).toBe('2h ago')
    expect(formatLastSynced(now - 23 * 60 * 60_000, now)).toBe('23h ago')
  })

  it('returns days when >= 24h', () => {
    expect(formatLastSynced(now - 25 * 60 * 60_000, now)).toBe('1d ago')
    expect(formatLastSynced(now - 7 * 24 * 60 * 60_000, now)).toBe('7d ago')
  })

  it('clamps negative diffs to "just now"', () => {
    expect(formatLastSynced(now + 5_000, now)).toBe('just now')
  })
})

describe('backoffFor', () => {
  it('returns the BACKOFF_MS series in order', () => {
    expect(backoffFor(0)).toBe(BACKOFF_MS[0])
    expect(backoffFor(1)).toBe(BACKOFF_MS[1])
    expect(backoffFor(2)).toBe(BACKOFF_MS[2])
    expect(backoffFor(3)).toBe(BACKOFF_MS[3])
  })

  it('caps at the last delay before MAX_ATTEMPTS', () => {
    expect(backoffFor(4)).toBe(BACKOFF_MS[BACKOFF_MS.length - 1])
  })

  it('returns null at/after MAX_ATTEMPTS (drop signal)', () => {
    expect(backoffFor(MAX_ATTEMPTS)).toBeNull()
    expect(backoffFor(MAX_ATTEMPTS + 5)).toBeNull()
  })
})

describe('isMedicalEvent', () => {
  it('matches each medical keyword', () => {
    for (const kw of MEDICAL_KEYWORDS) {
      expect(isMedicalEvent({ title: `Meeting at the ${kw}` })).toBe(true)
    }
  })

  it('is case insensitive', () => {
    expect(isMedicalEvent({ title: 'CLINIC visit' })).toBe(true)
    expect(isMedicalEvent({ title: 'MyChart Reminder' })).toBe(true)
  })

  it('matches keyword found in notes', () => {
    expect(isMedicalEvent({ title: 'Follow up', notes: 'Bring labs to oncology' })).toBe(true)
  })

  it('matches keyword found in calendar title', () => {
    expect(isMedicalEvent({ title: 'Visit', calendarTitle: 'Hospital Calendar' })).toBe(true)
  })

  it('matches keyword in location', () => {
    expect(isMedicalEvent({ title: 'Coffee', location: 'Memorial Hospital' })).toBe(true)
  })

  it('returns false for non-medical events', () => {
    expect(isMedicalEvent({ title: 'Birthday party' })).toBe(false)
    expect(isMedicalEvent({ title: 'Lunch', notes: 'with team', calendarTitle: 'Work' })).toBe(false)
  })

  it('handles missing optional fields safely', () => {
    expect(isMedicalEvent({ title: 'Doctor visit' })).toBe(true)
    expect(isMedicalEvent({ title: 'Standup', notes: null, location: null })).toBe(false)
  })
})
