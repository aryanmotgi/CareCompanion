import { describe, it, expect } from 'vitest'
import { generateICS } from '../calendar'

describe('generateICS', () => {
  it('generates valid ICS format', () => {
    const start = new Date('2026-04-15T10:00:00Z')
    const end = new Date('2026-04-15T11:00:00Z')
    const ics = generateICS('Dr. Chen Appointment', start, end, 'Main St Clinic', 'A1C check')

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Dr. Chen Appointment')
    expect(ics).toContain('LOCATION:Main St Clinic')
    expect(ics).toContain('DESCRIPTION:A1C check')
  })

  it('handles special characters in title', () => {
    const start = new Date('2026-04-15T10:00:00Z')
    const end = new Date('2026-04-15T11:00:00Z')
    const ics = generateICS('Dr. O\'Brien, Cardiology', start, end)

    expect(ics).toContain('SUMMARY:Dr. O\'Brien\\, Cardiology')
  })

  it('omits optional fields when not provided', () => {
    const start = new Date('2026-04-15T10:00:00Z')
    const end = new Date('2026-04-15T11:00:00Z')
    const ics = generateICS('Appointment', start, end)

    expect(ics).not.toContain('LOCATION:')
    expect(ics).not.toContain('DESCRIPTION:')
  })
})
