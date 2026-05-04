'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useToast } from './ToastProvider'
import { useCsrfToken } from './CsrfProvider'
import { SettingsRow } from '@/components/ui/SettingsRow'
import type { UserSettings, NotificationCategoryPrefs } from '@/lib/types'

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className="min-w-[44px] min-h-[44px] flex items-center justify-center"
    >
      <div className={`w-[44px] h-[24px] rounded-full relative transition-colors duration-200 ${
        enabled ? 'bg-[#A78BFA]' : 'bg-white/[0.1]'
      }`}>
        <div
          className={`w-[18px] h-[18px] rounded-full absolute top-[3px] transition-all duration-200 shadow-sm ${
            enabled ? 'right-[3px] bg-white' : 'left-[3px] bg-[#64748b]'
          }`}
        />
      </div>
    </button>
  )
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_PREFS: Required<NotificationCategoryPrefs> = {
  medications: {
    enabled: true,
    refill_reminders: true,
    dose_reminders: true,
    interaction_alerts: true,
  },
  appointments: {
    enabled: true,
    reminder_24hr: true,
    reminder_1hr: true,
    prep_reminder: true,
  },
  lab_results: {
    enabled: true,
    new_results: true,
    abnormal_alerts: true,
    trend_alerts: true,
  },
  insurance: {
    enabled: true,
    claim_status: true,
    prior_auth: true,
    appeal_deadlines: true,
  },
  care_team: {
    enabled: true,
    wellness_checkins: true,
    shared_records: true,
  },
}

// ─── Types ───────────────────────────────────────────────────────────────────

type CategoryKey = keyof NotificationCategoryPrefs

interface CategoryConfig {
  key: CategoryKey
  label: string
  icon: string
  subToggles: { key: string; label: string; description: string }[]
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'medications',
    label: 'Medications',
    icon: '',
    subToggles: [
      { key: 'refill_reminders', label: 'Refill Reminders', description: 'Alert when medications are running low' },
      { key: 'dose_reminders', label: 'Dose Reminders', description: 'Scheduled medication dose alerts' },
      { key: 'interaction_alerts', label: 'Interaction Alerts', description: 'Warnings about drug interactions' },
    ],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: '',
    subToggles: [
      { key: 'reminder_24hr', label: '24-Hour Reminder', description: 'Reminder the day before' },
      { key: 'reminder_1hr', label: '1-Hour Reminder', description: 'Reminder one hour before' },
      { key: 'prep_reminder', label: 'Prep Reminder', description: 'Any prep instructions before the visit' },
    ],
  },
  {
    key: 'lab_results',
    label: 'Lab Results',
    icon: '',
    subToggles: [
      { key: 'new_results', label: 'New Results Available', description: 'Notify when new labs come in' },
      { key: 'abnormal_alerts', label: 'Abnormal Results Alert', description: 'Flag results outside normal range' },
      { key: 'trend_alerts', label: 'Trend Alerts', description: 'Notify on significant changes over time' },
    ],
  },
  {
    key: 'insurance',
    label: 'Insurance',
    icon: '',
    subToggles: [
      { key: 'claim_status', label: 'Claim Status Updates', description: 'Status changes on submitted claims' },
      { key: 'prior_auth', label: 'Prior Auth Updates', description: 'Authorization request status changes' },
      { key: 'appeal_deadlines', label: 'Appeal Deadlines', description: 'Upcoming deadlines for appeals' },
    ],
  },
  {
    key: 'care_team',
    label: 'Care Team',
    icon: '',
    subToggles: [
      { key: 'wellness_checkins', label: 'Caregiver Wellness Check-ins', description: 'Periodic caregiver wellness prompts' },
      { key: 'shared_records', label: 'Shared Record Notifications', description: 'When care team members update records' },
    ],
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

interface NotificationPreferencesProps {
  settings: UserSettings | null
  onSettingsChange: (settings: UserSettings) => void
}

export function NotificationPreferences({ settings, onSettingsChange }: NotificationPreferencesProps) {
  const { showToast } = useToast()
  const csrfToken = useCsrfToken()
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize from persisted JSONB field, falling back to aggregate DB flags, then defaults
  const [prefs, setPrefs] = useState<Required<NotificationCategoryPrefs>>(() => {
    const stored = settings?.notificationPreferences as Partial<Required<NotificationCategoryPrefs>> | null
    if (stored && Object.keys(stored).length > 0) {
      return {
        medications: { ...DEFAULT_PREFS.medications, ...stored.medications },
        appointments: { ...DEFAULT_PREFS.appointments, ...stored.appointments },
        lab_results: { ...DEFAULT_PREFS.lab_results, ...stored.lab_results },
        insurance: { ...DEFAULT_PREFS.insurance, ...stored.insurance },
        care_team: { ...DEFAULT_PREFS.care_team, ...stored.care_team },
      }
    }
    // First load: seed from aggregate DB flags
    return {
      medications: { ...DEFAULT_PREFS.medications, enabled: settings?.refillReminders ?? true, refill_reminders: settings?.refillReminders ?? true },
      appointments: { ...DEFAULT_PREFS.appointments, enabled: settings?.appointmentReminders ?? true },
      lab_results: { ...DEFAULT_PREFS.lab_results, enabled: settings?.labAlerts ?? true },
      insurance: { ...DEFAULT_PREFS.insurance, enabled: settings?.claimUpdates ?? true, claim_status: settings?.claimUpdates ?? true },
      care_team: { ...DEFAULT_PREFS.care_team },
    }
  })

  const [quietHours, setQuietHours] = useState({
    enabled: !!(settings?.quietHoursEnabled ?? settings?.quietHoursStart),
    start: settings?.quietHoursStart ?? '22:00',
    end: settings?.quietHoursEnd ?? '07:00',
  })

  const [timezone, setTimezone] = useState(settings?.timezone ?? 'America/New_York')

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current)
    }
  }, [])

  const persistChanges = useCallback((
    updatedPrefs: Required<NotificationCategoryPrefs>,
    updatedQuietHours: typeof quietHours,
    updatedTimezone?: string,
  ) => {
    if (!settings) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')

    debounceRef.current = setTimeout(async () => {
      try {
        const payload = {
          quiet_hours_start: updatedQuietHours.enabled ? updatedQuietHours.start : null,
          quiet_hours_end: updatedQuietHours.enabled ? updatedQuietHours.end : null,
          quiet_hours_enabled: updatedQuietHours.enabled,
          timezone: updatedTimezone ?? timezone,
          refill_reminders: updatedPrefs.medications.refill_reminders && updatedPrefs.medications.enabled,
          appointment_reminders: updatedPrefs.appointments.enabled,
          lab_alerts: updatedPrefs.lab_results.enabled,
          claim_updates: updatedPrefs.insurance.claim_status && updatedPrefs.insurance.enabled,
          // Persist full sub-toggle state as JSONB so refreshing restores exact state
          notification_preferences: updatedPrefs,
        }

        const res = await fetch('/api/records/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error('Failed to save')

        onSettingsChange({
          ...settings,
          quietHoursStart: payload.quiet_hours_start,
          quietHoursEnd: payload.quiet_hours_end,
          refillReminders: payload.refill_reminders,
          appointmentReminders: payload.appointment_reminders,
          labAlerts: payload.lab_alerts,
          claimUpdates: payload.claim_updates,
        })

        setSaveStatus('saved')
        showToast('Preferences saved', 'success')
        if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current)
        saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        showToast('Failed to save notification preferences', 'error')
        setSaveStatus('idle')
      }
    }, 600)
  }, [settings, onSettingsChange, showToast, csrfToken])

  const toggleCategory = (categoryKey: CategoryKey) => {
    const category = prefs[categoryKey]
    if (!category) return
    const newEnabled = !category.enabled

    // When enabling a master toggle, turn all sub-toggles on.
    // When disabling, keep sub-toggles as-is but master is off.
    const updated = {
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

    setPrefs(updated)
    persistChanges(updated, quietHours)
  }

  const toggleSubSetting = (categoryKey: CategoryKey, subKey: string) => {
    const category = prefs[categoryKey] as Record<string, boolean>
    if (!category) return

    const newValue = !category[subKey]
    const updatedCategory = { ...category, [subKey]: newValue }

    // If all sub-toggles are off, disable master. If any are on, enable master.
    const subKeys = Object.keys(updatedCategory).filter((k) => k !== 'enabled')
    const anyOn = subKeys.some((k) => updatedCategory[k])
    updatedCategory.enabled = anyOn

    const updated = { ...prefs, [categoryKey]: updatedCategory } as Required<NotificationCategoryPrefs>
    setPrefs(updated)
    persistChanges(updated, quietHours)
  }

  const toggleQuietHours = () => {
    const updated = { ...quietHours, enabled: !quietHours.enabled }
    setQuietHours(updated)
    persistChanges(prefs, updated)
  }

  const updateQuietHoursTime = (field: 'start' | 'end', value: string) => {
    const updated = { ...quietHours, [field]: value }
    setQuietHours(updated)
    persistChanges(prefs, updated)
  }

  const updateTimezone = (tz: string) => {
    setTimezone(tz)
    persistChanges(prefs, quietHours, tz)
  }

  return (
    <div className="space-y-4">
      {/* Save indicator */}
      <div className="flex items-center justify-end">
        {saveStatus !== 'idle' && (
          <div
            className={`text-[11px] font-medium transition-opacity duration-300 ${
              saveStatus === 'saving' ? 'text-[#64748b]' : 'text-[#10b981]'
            }`}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </div>
        )}
      </div>

      {/* Notification categories */}
      {CATEGORIES.map((cat) => {
        const category = prefs[cat.key] as Record<string, boolean> | undefined
        if (!category) return null
        const isEnabled = category.enabled

        return (
          <div
            key={cat.key}
            className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]"
          >
            {/* Master toggle row */}
            <SettingsRow
              label={cat.label}
              right={
                <Toggle
                  label={`${cat.label} notifications`}
                  enabled={isEnabled}
                  onToggle={() => toggleCategory(cat.key)}
                />
              }
            />

            {/* Sub-toggles — only shown when master is enabled */}
            {isEnabled &&
              cat.subToggles.map((sub) => (
                <SettingsRow
                  key={sub.key}
                  label={sub.label}
                  description={sub.description}
                  indent
                  right={
                    <Toggle
                      label={sub.label}
                      enabled={category[sub.key] ?? true}
                      onToggle={() => toggleSubSetting(cat.key, sub.key)}
                    />
                  }
                />
              ))}
          </div>
        )
      })}

      {/* Quiet Hours */}
      <div className="text-[#64748b] text-[11px] uppercase tracking-wider mt-6">
        Quiet Hours
      </div>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
        <SettingsRow
          label="Enable Quiet Hours"
          description="Silence notifications during set hours"
          right={
            <Toggle
              label="Quiet Hours"
              enabled={quietHours.enabled}
              onToggle={toggleQuietHours}
            />
          }
        />

        {quietHours.enabled && (
          <>
            <div className="px-4 py-3.5 flex items-center justify-between pl-8">
              <div className="text-sm text-[#e2e8f0]">Start Time</div>
              <input
                type="time"
                value={quietHours.start}
                onChange={(e) => updateQuietHoursTime('start', e.target.value)}
                className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[#e2e8f0] text-sm outline-none focus:border-[#A78BFA]/40 transition-colors [color-scheme:dark]"
                aria-label="Quiet hours start time"
              />
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between pl-8">
              <div className="text-sm text-[#e2e8f0]">End Time</div>
              <input
                type="time"
                value={quietHours.end}
                onChange={(e) => updateQuietHoursTime('end', e.target.value)}
                className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-[#e2e8f0] text-sm outline-none focus:border-[#A78BFA]/40 transition-colors [color-scheme:dark]"
                aria-label="Quiet hours end time"
              />
            </div>
            <div className="px-4 py-3.5 flex items-center justify-between pl-8">
              <div className="text-sm text-[#e2e8f0]">Your Timezone</div>
              <select
                value={timezone}
                onChange={(e) => updateTimezone(e.target.value)}
                className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[#e2e8f0] text-sm outline-none focus:border-[#A78BFA]/40 transition-colors"
                aria-label="Timezone for quiet hours"
              >
                <option value="America/New_York">Eastern (ET)</option>
                <option value="America/Chicago">Central (CT)</option>
                <option value="America/Denver">Mountain (MT)</option>
                <option value="America/Los_Angeles">Pacific (PT)</option>
                <option value="America/Anchorage">Alaska (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii (HT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
