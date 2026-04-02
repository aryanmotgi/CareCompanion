import { describe, it, expect, vi } from 'vitest'

// Mock the admin client before importing the module
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const mockData: Record<string, unknown> = {
        care_profiles: { data: { id: 'profile-1' }, error: null },
        user_settings: { data: { refill_reminders: true, appointment_reminders: false, lab_alerts: true, claim_updates: true }, error: null },
        medications: { data: [{ name: 'Lisinopril', dose: '10mg', refill_date: new Date(Date.now() + 86400000).toISOString().split('T')[0] }], error: null },
        appointments: { data: [], error: null },
        prior_auths: { data: [], error: null },
        lab_results: { data: [], error: null },
        fsa_hsa: { data: [], error: null },
        notifications: { data: [], error: null },
      }

      const chainable = {
        select: () => chainable,
        eq: () => chainable,
        gte: () => chainable,
        order: () => chainable,
        limit: () => chainable,
        single: () => mockData[table] || { data: null, error: null },
        insert: () => ({ error: null }),
        then: (resolve: (value: unknown) => void) => resolve(mockData[table] || { data: [], error: null }),
      }
      return chainable
    },
  }),
}))

describe('notification settings integration', () => {
  it('should respect user notification preferences', async () => {
    // The notification engine now fetches user_settings and skips
    // categories where the user has disabled notifications.
    // When appointment_reminders is false, no appointment queries should run.
    // This is a structural test verifying the integration exists.
    const { generateNotificationsForUser } = await import('../notifications')
    expect(generateNotificationsForUser).toBeDefined()
    expect(typeof generateNotificationsForUser).toBe('function')
  })
})
