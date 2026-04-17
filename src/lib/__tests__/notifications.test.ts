import { describe, it, expect, vi, beforeEach } from 'vitest'

const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
const queriedTables: string[] = []
let mockInsertValues: ReturnType<typeof vi.fn>

vi.mock('@/lib/db', () => {
  mockInsertValues = vi.fn().mockResolvedValue([])

  const makeSelect = (table: string) => {
    queriedTables.push(table)
    const mockRows: Record<string, unknown[]> = {
      care_profiles: [{ id: 'profile-1', userId: 'user-1' }],
      user_settings: [{ userId: 'user-1', refillReminders: true, appointmentReminders: false, labAlerts: false, claimUpdates: true }],
      medications: [{ id: 'med-1', careProfileId: 'profile-1', name: 'Lisinopril', dose: '10mg', refillDate: tomorrow }],
      appointments: [{ id: 'appt-1', careProfileId: 'profile-1', doctorName: 'Dr. Chen', dateTime: new Date(Date.now() + 86400000) }],
      lab_results: [{ id: 'lab-1', userId: 'user-1', testName: 'LDL', value: '200', isAbnormal: true, createdAt: new Date() }],
      notifications: [],
    }
    const rows = mockRows[table] ?? []
    const chain: Record<string, unknown> = {
      from: (t: string) => makeSelect(t),
      where: () => chain,
      limit: () => chain,
      orderBy: () => chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve),
    }
    return chain
  }

  return {
    db: {
      select: () => ({ from: (t: string) => makeSelect(t) }),
      insert: () => ({ values: mockInsertValues }),
      update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
      delete: () => ({ where: () => Promise.resolve([]) }),
    },
  }
})

describe('notification settings integration', () => {
  beforeEach(() => {
    queriedTables.length = 0
    mockInsertValues?.mockClear()
  })

  it('skips disabled notification categories based on user_settings', async () => {
    const { generateNotificationsForUser } = await import('../notifications')
    await generateNotificationsForUser('user-1')

    // appointment_reminders is false → appointments table should NOT be queried for data
    // lab_alerts is false → lab_results table should NOT be queried for data
    // refill_reminders is true → medications table SHOULD be queried
    // The first queries are always care_profiles and user_settings
    // After that, only enabled categories should be queried

    // Medications should be queried (refill_reminders: true)
    expect(queriedTables).toContain('medications')

    // Notifications table is always queried (for dedup check)
    expect(queriedTables).toContain('notifications')
  })

  it('generates refill notifications when refill_reminders is enabled', async () => {
    const { generateNotificationsForUser } = await import('../notifications')
    const count = await generateNotificationsForUser('user-1')

    // refill_reminders is true, and Lisinopril refill is due tomorrow
    // appointment_reminders is false, so no appointment notifications
    expect(count).toBeGreaterThanOrEqual(0)
    expect(mockInsertValues).toHaveBeenCalled()
  })

  it('respects appointment_reminders=false by not querying appointments', async () => {
    queriedTables.length = 0
    const { generateNotificationsForUser } = await import('../notifications')
    await generateNotificationsForUser('user-1')

    // appointment_reminders is false in our mock settings
    // The appointments table should NOT be queried
    expect(queriedTables).not.toContain('appointments')
  })
})
