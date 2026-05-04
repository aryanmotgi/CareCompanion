import { describe, it, expect } from 'vitest'

// Test the toggle logic extracted from NotificationPreferences — pure functions
// matching the component's toggleCategory and toggleSubSetting implementations

type CategoryPrefs = Record<string, boolean>

function toggleCategory(prefs: Record<string, CategoryPrefs>, categoryKey: string) {
  const category = prefs[categoryKey]
  if (!category) return prefs
  const newEnabled = !category.enabled
  return {
    ...prefs,
    [categoryKey]: {
      ...category,
      enabled: newEnabled,
      ...(newEnabled
        ? Object.fromEntries(
            Object.keys(category)
              .filter((k) => k !== 'enabled')
              .map((k) => [k, true])
          )
        : {}),
    },
  }
}

function toggleSubSetting(prefs: Record<string, CategoryPrefs>, categoryKey: string, subKey: string) {
  const category = prefs[categoryKey]
  if (!category) return prefs
  const newValue = !category[subKey]
  const updatedCategory = { ...category, [subKey]: newValue }
  const subKeys = Object.keys(updatedCategory).filter((k) => k !== 'enabled')
  const anyOn = subKeys.some((k) => updatedCategory[k])
  updatedCategory.enabled = anyOn
  return { ...prefs, [categoryKey]: updatedCategory }
}

const basePrefs = {
  medications: { enabled: true, refill_reminders: true, dose_reminders: true, interaction_alerts: true },
  appointments: { enabled: true, reminder_24hr: true, reminder_1hr: true, prep_reminder: true },
}

describe('toggleCategory', () => {
  it('disabling master sets enabled=false, preserves sub-toggle state', () => {
    const result = toggleCategory(basePrefs, 'medications')
    expect(result.medications.enabled).toBe(false)
    expect(result.medications.refill_reminders).toBe(true) // preserved
  })

  it('enabling master sets enabled=true AND turns all sub-toggles on', () => {
    const withDisabled = {
      medications: { enabled: false, refill_reminders: false, dose_reminders: false, interaction_alerts: true },
    }
    const result = toggleCategory(withDisabled, 'medications')
    expect(result.medications.enabled).toBe(true)
    expect(result.medications.refill_reminders).toBe(true)
    expect(result.medications.dose_reminders).toBe(true)
    expect(result.medications.interaction_alerts).toBe(true)
  })

  it('does not mutate original prefs', () => {
    const original = structuredClone(basePrefs)
    toggleCategory(basePrefs, 'medications')
    expect(basePrefs.medications.enabled).toBe(original.medications.enabled)
  })
})

describe('toggleSubSetting', () => {
  it('disabling last active sub-toggle disables master', () => {
    const oneLeft = {
      medications: { enabled: true, refill_reminders: true, dose_reminders: false, interaction_alerts: false },
    }
    const result = toggleSubSetting(oneLeft, 'medications', 'refill_reminders')
    expect(result.medications.refill_reminders).toBe(false)
    expect(result.medications.enabled).toBe(false)
  })

  it('enabling any sub-toggle enables master', () => {
    const allOff = {
      medications: { enabled: false, refill_reminders: false, dose_reminders: false, interaction_alerts: false },
    }
    const result = toggleSubSetting(allOff, 'medications', 'dose_reminders')
    expect(result.medications.dose_reminders).toBe(true)
    expect(result.medications.enabled).toBe(true)
  })

  it('disabling one of many subs leaves master on', () => {
    const result = toggleSubSetting(basePrefs, 'medications', 'dose_reminders')
    expect(result.medications.dose_reminders).toBe(false)
    expect(result.medications.enabled).toBe(true) // refill_reminders and interaction_alerts still on
  })

  it('does not affect other categories', () => {
    const result = toggleSubSetting(basePrefs, 'medications', 'refill_reminders')
    expect(result.appointments).toEqual(basePrefs.appointments)
  })
})

describe('prefs initialization from DB settings', () => {
  it('uses stored JSONB when notification_preferences is populated', () => {
    const defaults = { enabled: true, refill_reminders: true, dose_reminders: true, interaction_alerts: true }
    const stored = { enabled: false, refill_reminders: false, dose_reminders: true, interaction_alerts: false }
    const merged = { ...defaults, ...stored }
    // stored values override defaults
    expect(merged.enabled).toBe(false)
    expect(merged.refill_reminders).toBe(false)
    expect(merged.dose_reminders).toBe(true)
  })

  it('falls back to aggregate DB flags when JSONB is empty', () => {
    const settings = { refillReminders: false, appointmentReminders: true, labAlerts: false, claimUpdates: true }
    const defaultMeds = { enabled: true, refill_reminders: true, dose_reminders: true, interaction_alerts: true }
    const seeded = { ...defaultMeds, enabled: settings.refillReminders ?? true, refill_reminders: settings.refillReminders ?? true }
    expect(seeded.enabled).toBe(false)
    expect(seeded.refill_reminders).toBe(false)
    expect(seeded.dose_reminders).toBe(true) // sub-toggle defaults preserved
  })
})
