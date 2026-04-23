'use client'

import { useState } from 'react'
import { useToast } from './ToastProvider'
import { useCsrfToken } from './CsrfProvider'
import { ThemeToggle } from './ThemeToggle'
import { ReminderManager } from './ReminderManager'
import { NotificationPreferences } from './NotificationPreferences'
import type { UserSettings, MedicationReminder, Medication } from '@/lib/types'

interface SettingsPageProps {
  settings: UserSettings | null
  medicationReminders?: MedicationReminder[]
  medications?: Medication[]
  isDemo?: boolean
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

export function SettingsPage({ settings: initialSettings, medicationReminders = [], medications = [], isDemo = false }: SettingsPageProps) {
  const { showToast } = useToast()
  const csrfToken = useCsrfToken()
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showCsvMenu, setShowCsvMenu] = useState(false)
  const [resetting, setResetting] = useState(false)

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'
  const showTestTools = isTestMode

  const handleResetTestData = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/test/reset', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Reset failed')
      }
      showToast('Test data reset to initial state', 'success')
      window.location.reload()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to reset test data', 'error')
    } finally {
      setResetting(false)
    }
  }

  const handleExportCsv = async (type: string) => {
    setShowCsvMenu(false)
    setExporting(true)
    try {
      const res = await fetch(`/api/export/csv?type=${type}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Export failed')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showToast('CSV exported', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to export CSV', 'error')
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setImporting(true)
      try {
        const text = await file.text()
        const json = JSON.parse(text)
        const res = await fetch('/api/import-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Import failed')
        }
        const result = await res.json()
        const counts = result.imported
        const parts = []
        if (counts.medications) parts.push(`${counts.medications} medications`)
        if (counts.appointments) parts.push(`${counts.appointments} appointments`)
        if (counts.lab_results) parts.push(`${counts.lab_results} lab results`)
        showToast(parts.length ? `Imported ${parts.join(', ')}` : 'No data imported', parts.length ? 'success' : 'error')
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Failed to import data', 'error')
      } finally {
        setImporting(false)
      }
    }
    input.click()
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) return
    setSaving(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) throw new Error('Failed to update password')
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
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
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
      <NotificationPreferences
        settings={settings}
        onSettingsChange={(updated) => setSettings(updated)}
      />

      <SectionLabel>Medication Reminders</SectionLabel>
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden p-4">
        <ReminderManager reminders={medicationReminders} medications={medications} />
      </div>

      <SectionLabel>App Preferences</SectionLabel>
      <SettingsGroup>
        <div className="px-4 py-3.5">
          <div className="text-sm text-[var(--text)] mb-2">Theme</div>
          <ThemeToggle />
        </div>
        <div className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#e2e8f0]">AI Personality</div>
              <div className="text-[11px] text-[#A78BFA] mt-0.5 font-medium">
                {settings?.aiPersonality === 'friendly' ? 'Warm & Friendly' : settings?.aiPersonality === 'concise' ? 'Brief & Concise' : 'Professional & Thorough'}
              </div>
            </div>
            <select
              value={settings?.aiPersonality || 'professional'}
              onChange={async (e) => {
                if (!settings) return
                const val = e.target.value as 'professional' | 'friendly' | 'concise'
                setSettings({ ...settings, aiPersonality: val })
                await fetch('/api/records/settings', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ aiPersonality: val }),
                })
              }}
              className="bg-transparent text-[#64748b] text-sm outline-none cursor-pointer"
              aria-label="AI Personality"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
            </select>
          </div>
        </div>
      </SettingsGroup>

      <SectionLabel>Data Management</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label={exporting ? 'Exporting...' : 'Export JSON (All Data)'}
          description="Download all your data as a JSON file"
          onClick={exporting ? undefined : handleExport}
        />
        <div className="relative">
          <SettingsRow
            label={exporting ? 'Exporting...' : 'Export CSV'}
            description="Download specific data as a CSV file"
            onClick={exporting ? undefined : () => setShowCsvMenu(!showCsvMenu)}
          />
          {showCsvMenu && (
            <div className="mx-4 mb-3 bg-white/[0.06] rounded-lg overflow-hidden">
              {[
                { key: 'medications', label: 'Medications' },
                { key: 'lab_results', label: 'Lab Results' },
                { key: 'appointments', label: 'Appointments' },
                { key: 'journal', label: 'Journal Entries' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => handleExportCsv(item.key)}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#e2e8f0] hover:bg-white/[0.04] transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <SettingsRow
          label={importing ? 'Importing...' : 'Import Data'}
          description="Import data from a JSON file"
          onClick={importing ? undefined : handleImport}
        />
      </SettingsGroup>

      <SectionLabel>Privacy &amp; Security</SectionLabel>
      <SettingsGroup>
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
          right={<span className="text-[#64748b] text-sm">0.1.2</span>}
        />
        <SettingsRow label="Terms of Service" onClick={() => window.open('/terms', '_blank')} />
        <SettingsRow label="Privacy Policy" onClick={() => window.open('/privacy', '_blank')} />
      </SettingsGroup>

      {showTestTools && (
        <>
          <SectionLabel>Test Tools</SectionLabel>
          <SettingsGroup>
            <SettingsRow
              label={resetting ? 'Resetting...' : 'Reset Test Data'}
              description="Restore this account to the initial seed state (staging only)"
              onClick={resetting ? undefined : handleResetTestData}
            />
          </SettingsGroup>
        </>
      )}

      <div className="h-8" />
    </div>
  )
}
