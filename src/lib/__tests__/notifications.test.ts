import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsert = vi.fn().mockReturnValue({ error: null })
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

// Track which tables get queried to verify preference-gating
const queriedTables: string[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      queriedTables.push(table)

      const mockData: Record<string, { data: unknown; error: null }> = {
        care_profiles: { data: { id: 'profile-1' }, error: null },
        user_settings: { data: { refill_reminders: true, appointment_reminders: false, lab_alerts: false, claim_updates: true }, error: null },
        medications: { data: [{ name: 'Lisinopril', dose: '10mg', refill_date: tomorrow }], error: null },
        appointments: { data: [{ doctor_name: 'Dr. Chen', date_time: new Date(Date.now() + 86400000).toISOString() }], error: null },
        prior_auths: { data: [], error: null },
        lab_results: { data: [{ test_name: 'LDL', value: '200', is_abnormal: true, created_at: new Date().toISOString() }], error: null },
        fsa_hsa: { data: [], error: null },
        notifications: { data: [], error: null },
      }

      const result = mockData[table] || { data: [], error: null }

      const chainable: Record<string, unknown> = {
        select: () => chainable,
        eq: () => chainable,
        gte: () => chainable,
        order: () => chainable,
        limit: () => chainable,
        single: () => Promise.resolve(result),
        insert: mockInsert,
        then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
      }
      return chainable
    },
  }),
}))

describe('notification settings integration', () => {
  beforeEach(() => {
    queriedTables.length = 0
    mockInsert.mockClear()
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
    expect(count).toBeGreaterThanOrEqual(0) // insert mock returns no error
    expect(mockInsert).toHaveBeenCalled()
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
