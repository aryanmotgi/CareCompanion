'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from './ToastProvider'
import type { UserSettings, ConnectedApp } from '@/lib/types'

interface SettingsPageProps {
  settings: UserSettings | null
  connectedApps: ConnectedApp[]
}

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
  onClick,
  danger,
}: {
  label: string
  description?: string
  right?: React.ReactNode
  onClick?: () => void
  danger?: boolean
}) {
  return (
    <div
      className={`px-4 py-3.5 flex items-center justify-between ${onClick ? 'cursor-pointer active:bg-white/[0.02]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div>
        <div className={`text-sm ${danger ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}`}>{label}</div>
        {description && <div className="text-[11px] text-[#64748b] mt-0.5">{description}</div>}
      </div>
      {right || (onClick && <span className="text-[#64748b] text-base" aria-hidden="true">›</span>)}
    </div>
  )
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[#64748b] text-[11px] uppercase tracking-wider mb-2 mt-6 first:mt-0">
      {children}
    </div>
  )
}

export function SettingsPage({ settings: initialSettings, connectedApps }: SettingsPageProps) {
  const router = useRouter()
  const { showToast } = useToast()
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const toggleSetting = (key: keyof UserSettings) => {
    if (!settings) return
    const newValue = !settings[key]
    setSettings({ ...settings, [key]: newValue })
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('user_settings')
          .update({ [key]: newValue, updated_at: new Date().toISOString() })
          .eq('user_id', settings.user_id)
        if (error) throw error
      } catch {
        showToast('Failed to save setting', 'error')
        setSettings({ ...settings, [key]: !newValue })
      }
    }, 500)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setShowPasswordForm(false)
      showToast('Password updated', 'success')
    } catch {
      showToast('Failed to update password', 'error')
    }
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/delete-account', { method: 'POST' })
      if (!res.ok) throw new Error('Delete failed')
      window.location.href = '/login'
    } catch {
      showToast('Failed to delete account', 'error')
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/export-data')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'carecompanion-data.json'
      a.click()
      URL.revokeObjectURL(url)
      showToast('Data exported', 'success')
    } catch {
      showToast('Failed to export data', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-6">Settings</h2>

      <SectionLabel>Care Profile</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="Edit Profile & Preferences"
          description="Update cancer type, treatment phase, and priorities"
          onClick={() => {
            window.location.href = '/onboarding'
          }}
        />
      </SettingsGroup>

      <SectionLabel>Notifications</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="Refill Reminders"
          description="Alert when medications are running low"
          right={<Toggle label="Refill Reminders" enabled={settings?.refill_reminders ?? true} onToggle={() => toggleSetting('refill_reminders')} />}
        />
        <SettingsRow
          label="Appointment Reminders"
          description="24 hours and 1 hour before"
          right={<Toggle label="Appointment Reminders" enabled={settings?.appointment_reminders ?? true} onToggle={() => toggleSetting('appointment_reminders')} />}
        />
        <SettingsRow
          label="Lab Result Alerts"
          description="Notify when new results are available"
          right={<Toggle label="Lab Result Alerts" enabled={settings?.lab_alerts ?? true} onToggle={() => toggleSetting('lab_alerts')} />}
        />
        <SettingsRow
          label="Claim Updates"
          description="Status changes on insurance claims"
          right={<Toggle label="Claim Updates" enabled={settings?.claim_updates ?? true} onToggle={() => toggleSetting('claim_updates')} />}
        />
      </SettingsGroup>

      <SectionLabel>Connected Accounts</SectionLabel>
      <SettingsGroup>
        {connectedApps.length === 0 ? (
          <SettingsRow
            label="No accounts connected"
            description="Connect health systems, insurance, and more"
            onClick={() => router.push('/connect')}
          />
        ) : (
          connectedApps.map((app) => (
            <SettingsRow
              key={app.id}
              label={app.source}
              description={app.last_synced ? `Last synced ${new Date(app.last_synced).toLocaleDateString()}` : undefined}
              right={<span className="text-[#10b981] text-xs font-semibold">Connected</span>}
              onClick={() => router.push('/connect')}
            />
          ))
        )}
        <SettingsRow label="Manage Connections" onClick={() => router.push('/connect')} />
      </SettingsGroup>

      <SectionLabel>App Preferences</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="Theme"
          right={<span className="text-[#64748b] text-sm">Dark</span>}
        />
        <SettingsRow
          label="AI Personality"
          right={
            <select
              value={settings?.ai_personality || 'professional'}
              onChange={async (e) => {
                if (!settings) return
                const val = e.target.value as 'professional' | 'friendly' | 'concise'
                setSettings({ ...settings, ai_personality: val })
                const supabase = createClient()
                await supabase.from('user_settings').update({ ai_personality: val, updated_at: new Date().toISOString() }).eq('user_id', settings.user_id)
              }}
              className="bg-transparent text-[#64748b] text-sm outline-none cursor-pointer"
              aria-label="AI Personality"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          }
        />
      </SettingsGroup>

      <SectionLabel>Privacy &amp; Security</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label={exporting ? 'Exporting...' : 'Export My Data'}
          onClick={exporting ? undefined : handleExport}
        />
        <SettingsRow
          label="Change Password"
          onClick={() => setShowPasswordForm(!showPasswordForm)}
        />
        <SettingsRow label="Delete Account" danger onClick={() => setShowDeleteConfirm(true)} />
      </SettingsGroup>

      {showPasswordForm && (
        <div className="mt-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <label className="text-[#94a3b8] text-xs mb-1.5 block" htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 6 characters"
            minLength={6}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[#e2e8f0] text-sm mb-3 outline-none focus:border-[#A78BFA]/40 transition-colors"
          />
          {newPassword.length > 0 && newPassword.length < 6 && (
            <p className="text-[#ef4444] text-xs mb-2">Password must be at least 6 characters</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={saving || newPassword.length < 6}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#6366F1] to-[#A78BFA] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="bg-[#1e293b] rounded-xl p-6 mx-5 max-w-sm w-full animate-slide-up">
            <h3 id="delete-dialog-title" className="text-[#f1f5f9] text-lg font-bold mb-2">Delete Account</h3>
            <p className="text-[#94a3b8] text-sm mb-4">
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-white/[0.06] text-[#e2e8f0] text-sm font-semibold hover:bg-white/[0.1] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionLabel>About</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="App Version"
          right={<span className="text-[#64748b] text-sm">1.0.0</span>}
        />
        <SettingsRow label="Terms &amp; Privacy Policy" onClick={() => {}} />
      </SettingsGroup>

      <div className="h-8" />
    </div>
  )
}
