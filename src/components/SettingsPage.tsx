'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserSettings, ConnectedApp } from '@/lib/types'

interface SettingsPageProps {
  settings: UserSettings | null
  connectedApps: ConnectedApp[]
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-[42px] h-6 rounded-full relative transition-colors duration-200 ${
        enabled ? 'bg-gradient-to-r from-indigo-500 to-cyan-400' : 'bg-white/[0.1]'
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
    >
      <div>
        <div className={`text-sm ${danger ? 'text-[#ef4444]' : 'text-[#e2e8f0]'}`}>{label}</div>
        {description && <div className="text-[11px] text-[#64748b] mt-0.5">{description}</div>}
      </div>
      {right || (onClick && <span className="text-[#64748b] text-base">›</span>)}
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
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleSetting = async (key: keyof UserSettings) => {
    if (!settings) return
    const supabase = createClient()
    const newValue = !settings[key]
    setSettings({ ...settings, [key]: newValue })
    await supabase
      .from('user_settings')
      .update({ [key]: newValue, updated_at: new Date().toISOString() })
      .eq('user_id', settings.user_id)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return
    setSaving(true)
    const supabase = createClient()
    await supabase.auth.updateUser({ password: newPassword })
    setNewPassword('')
    setShowPasswordForm(false)
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    setSaving(true)
    const res = await fetch('/api/delete-account', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/login'
    }
    setSaving(false)
  }

  const handleExport = async () => {
    const res = await fetch('/api/export-data')
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'carecompanion-data.json'
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-[#f1f5f9] text-xl font-bold mb-6">Settings</h2>

      <SectionLabel>Notifications</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="Refill Reminders"
          description="Alert when medications are running low"
          right={<Toggle enabled={settings?.refill_reminders ?? true} onToggle={() => toggleSetting('refill_reminders')} />}
        />
        <SettingsRow
          label="Appointment Reminders"
          description="24 hours and 1 hour before"
          right={<Toggle enabled={settings?.appointment_reminders ?? true} onToggle={() => toggleSetting('appointment_reminders')} />}
        />
        <SettingsRow
          label="Lab Result Alerts"
          description="Notify when new results are available"
          right={<Toggle enabled={settings?.lab_alerts ?? true} onToggle={() => toggleSetting('lab_alerts')} />}
        />
        <SettingsRow
          label="Claim Updates"
          description="Status changes on insurance claims"
          right={<Toggle enabled={settings?.claim_updates ?? true} onToggle={() => toggleSetting('claim_updates')} />}
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
        <SettingsRow label="Export My Data" onClick={handleExport} />
        <SettingsRow
          label="Change Password"
          onClick={() => setShowPasswordForm(!showPasswordForm)}
        />
        <SettingsRow label="Delete Account" danger onClick={() => setShowDeleteConfirm(true)} />
      </SettingsGroup>

      {showPasswordForm && (
        <div className="mt-3 bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[#e2e8f0] text-sm mb-3 outline-none"
          />
          <button
            onClick={handleChangePassword}
            disabled={saving || newPassword.length < 6}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-semibold disabled:opacity-40"
          >
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[#1e293b] rounded-xl p-6 mx-5 max-w-sm w-full">
            <h3 className="text-[#f1f5f9] text-lg font-bold mb-2">Delete Account</h3>
            <p className="text-[#94a3b8] text-sm mb-4">
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-white/[0.06] text-[#e2e8f0] text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={saving}
                className="flex-1 py-2 rounded-lg bg-[#ef4444] text-white text-sm font-semibold disabled:opacity-40"
              >
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
