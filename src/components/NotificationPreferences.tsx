'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from './ToastProvider'
import type { UserSettings, NotificationCategoryPrefs } from '@/lib/types'

// ─── Shared UI primitives (same as SettingsPage) ─────────────────────────────

function Toggle({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={onToggle}
      className={`w-[42px] h-6 rounded-full relative transition-colors duration-200 min-w-[42px] min-h-[44px] flex items-center ${
        enabled ? 'bg-[#A78BFA]' : 'bg-white/[0.1]'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full absolute top-0.5 transition-all duration-200 ${
          enabled ? 'right-0.5 bg-white' : 'left-0.5 bg-[#64748b]'
        }`}
      />
    </button>
  )
}

function SettingsRow({
  label,
  description,
  right,
  indent,
}: {
  label: string
  description?: string
  right?: React.ReactNode
  indent?: boolean
}) {
  return (
    <div className={`px-4 py-3.5 flex items-center justify-between ${indent ? 'pl-8' : ''}`}>
      <div className="flex-1 mr-3">
        <div className="text-sm text-[#e2e8f0]">{label}</div>
        {description && <div className="text-[11px] text-[#64748b] mt-0.5">{description}</div>}
      </div>
      {right}
    </div>
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
    icon: '💊',
    subToggles: [
      { key: 'refill_reminders', label: 'Refill Reminders', description: 'Alert when medications are running low' },
      { key: 'dose_reminders', label: 'Dose Reminders', description: 'Scheduled medication dose alerts' },
      { key: 'interaction_alerts', label: 'Interaction Alerts', description: 'Warnings about drug interactions' },
    ],
  },
  {
    key: 'appointments',
    label: 'Appointments',
    icon: '📅',
    subToggles: [
      { key: 'reminder_24hr', label: '24-Hour Reminder', description: 'Reminder the day before' },
      { key: 'reminder_1hr', label: '1-Hour Reminder', description: 'Reminder one hour before' },
      { key: 'prep_reminder', label: 'Prep Reminder', description: 'Any prep instructions before the visit' },
    ],
  },
  {
    key: 'lab_results',
    label: 'Lab Results',
    icon: '🔬',
    subToggles: [
      { key: 'new_results', label: 'New Results Available', description: 'Notify when new labs come in' },
      { key: 'abnormal_alerts', label: 'Abnormal Results Alert', description: 'Flag results outside normal range' },
      { key: 'trend_alerts', label: 'Trend Alerts', description: 'Notify on significant changes over time' },
    ],
  },
  {
    key: 'insurance',
    label: 'Insurance',
    icon: '🛡️',
    subToggles: [
      { key: 'claim_status', label: 'Claim Status Updates', description: 'Status changes on submitted claims' },
      { key: 'prior_auth', label: 'Prior Auth Updates', description: 'Authorization request status changes' },
      { key: 'appeal_deadlines', label: 'Appeal Deadlines', description: 'Upcoming deadlines for appeals' },
    ],
  },
  {
    key: 'care_team',
    label: 'Care Team',
    icon: '👥',
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
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Merge stored prefs with defaults
  const [prefs, setPrefs] = useState<Required<NotificationCategoryPrefs>>(() => {
    const stored = settings?.notification_preferences
    return {
      medications: { ...DEFAULT_PREFS.medications, ...stored?.medications },
      appointments: { ...DEFAULT_PREFS.appointments, ...stored?.appointments },
      lab_results: { ...DEFAULT_PREFS.lab_results, ...stored?.lab_results },
      insurance: { ...DEFAULT_PREFS.insurance, ...stored?.insurance },
      care_team: { ...DEFAULT_PREFS.care_team, ...stored?.care_team },
    }
  })

  const [quietHours, setQuietHours] = useState({
    enabled: settings?.quiet_hours_enabled ?? false,
    start: settings?.quiet_hours_start ?? '22:00',
    end: settings?.quiet_hours_end ?? '07:00',
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current)
    }
  }, [])

  const persistChanges = useCallback((
    updatedPrefs: Required<NotificationCategoryPrefs>,
    updatedQuietHours: typeof quietHours
  ) => {
    if (!settings) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus('saving')

    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        const payload = {
          notification_preferences: updatedPrefs,
          quiet_hours_enabled: updatedQuietHours.enabled,
          quiet_hours_start: updatedQuietHours.enabled ? updatedQuietHours.start : undefined,
          quiet_hours_end: updatedQuietHours.enabled ? updatedQuietHours.end : undefined,
          // Keep legacy fields in sync
          refill_reminders: updatedPrefs.medications.refill_reminders && updatedPrefs.medications.enabled,
          appointment_reminders: updatedPrefs.appointments.enabled,
          lab_alerts: updatedPrefs.lab_results.enabled,
          claim_updates: updatedPrefs.insurance.claim_status && updatedPrefs.insurance.enabled,
          updated_at: new Date().toISOString(),
        }

        const { error } = await supabase
          .from('user_settings')
          .update(payload)
          .eq('user_id', settings.user_id)

        if (error) throw error

        onSettingsChange({
          ...settings,
          ...payload,
          notification_preferences: updatedPrefs,
        })

        setSaveStatus('saved')
        if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current)
        saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        showToast('Failed to save notification preferences', 'error')
        setSaveStatus('idle')
      }
    }, 600)
  }, [settings, onSettingsChange, showToast])

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
              label={`${cat.icon}  ${cat.label}`}
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
          </>
        )}
      </div>
    </div>
  )
}
