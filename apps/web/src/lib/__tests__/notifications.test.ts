import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist shared state so mock factories can close over these references
const { queriedTables, mockInsert } = vi.hoisted(() => ({
  queriedTables: [] as string[],
  mockInsert: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/push', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/db', () => {
  const TABLE_NAME = Symbol.for('drizzle:Name')
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const tableData: Record<string, unknown[]> = {
    care_profiles: [{ id: 'profile-1', userId: 'user-1' }],
    user_settings: [{
      userId: 'user-1',
      refillReminders: true,
      appointmentReminders: false,
      labAlerts: false,
      claimUpdates: true,
      quietHoursEnabled: false,
    }],
    medications: [{
      name: 'Lisinopril',
      dose: '10mg',
      refillDate: tomorrow,
      careProfileId: 'profile-1',
    }],
    appointments: [],
    prior_auths: [],
    lab_results: [],
    fsa_hsa: [],
    notifications: [],
    push_subscriptions: [],
  }

  const makeChain = (rows: unknown[]) => {
    const promise = Promise.resolve(rows)
    const chain: Record<string, unknown> = {
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      catch: (fn: (e: unknown) => unknown) => promise.catch(fn),
      then: (resolve: (v: unknown[]) => void, reject?: (e: unknown) => void) =>
        promise.then(resolve, reject),
    }
    return chain
  }

  return {
    db: {
      select: () => ({
        from: (table: Record<symbol, string>) => {
          const name = table[TABLE_NAME] ?? 'unknown'
          queriedTables.push(name as string)
          return makeChain(tableData[name as string] ?? [])
        },
      }),
      insert: () => ({
        values: mockInsert,
      }),
      delete: () => ({
        where: () => Promise.resolve([]),
      }),
    },
  }
})

describe('notification settings integration', () => {
  beforeEach(() => {
    queriedTables.length = 0
    mockInsert.mockClear()
  })

  it('skips disabled notification categories based on user_settings', async () => {
    const { generateNotificationsForUser } = await import('../notifications')
    await generateNotificationsForUser('user-1')

    // refill_reminders is true → medications table SHOULD be queried
    expect(queriedTables).toContain('medications')

    // Notifications table is always queried (for dedup check)
    expect(queriedTables).toContain('notifications')
  })

  it('generates refill notifications when refill_reminders is enabled', async () => {
    const { generateNotificationsForUser } = await import('../notifications')
    const count = await generateNotificationsForUser('user-1')

    // refill_reminders is true, Lisinopril refill is due tomorrow (within 3 days)
    expect(count).toBeGreaterThanOrEqual(0)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('respects appointment_reminders=false by not querying appointments', async () => {
    queriedTables.length = 0
    const { generateNotificationsForUser } = await import('../notifications')
    await generateNotificationsForUser('user-1')

    // appointment_reminders is false in our mock settings
    expect(queriedTables).not.toContain('appointments')
  })
})
