'use client'

import { useState, useEffect } from 'react'
import { useToast } from './ToastProvider'
import { useCsrfToken } from './CsrfProvider'
import { ThemeToggle } from './ThemeToggle'
import { ReminderManager } from './ReminderManager'
import { NotificationPreferences } from './NotificationPreferences'
import { InfoTooltip } from './InfoTooltip'
import type { UserSettings, MedicationReminder, Medication } from '@/lib/types'
import { SettingsRow } from '@/components/ui/SettingsRow'

interface ConnectedApp {
  id: string
  source: string
  lastSynced: Date | null
  expiresAt: Date | null
}

interface SettingsPageProps {
  settings: UserSettings | null
  medicationReminders?: MedicationReminder[]
  medications?: Medication[]
  isDemo?: boolean
  integrations?: ConnectedApp[]
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

export function SettingsPage({ settings: initialSettings, medicationReminders = [], medications = [], integrations: initialIntegrations = [] }: SettingsPageProps) {
  const { showToast } = useToast()
  const csrfToken = useCsrfToken()
  const [settings, setSettings] = useState<UserSettings | null>(initialSettings)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showCsvMenu, setShowCsvMenu] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [integrations, setIntegrations] = useState<ConnectedApp[]>(initialIntegrations)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  interface ShareLink { token: string; type: string; title: string; expiresAt: string; createdAt: string }
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([])
  const [revokingToken, setRevokingToken] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/share')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => { if (json?.data?.links) setShareLinks(json.data.links) })
      .catch(() => {})
  }, [])

  const handleRevokeLink = async (token: string) => {
    setRevokingToken(token)
    try {
      const res = await fetch(`/api/share/${token}/revoke`, {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken },
      })
      if (res.ok) setShareLinks((prev) => prev.filter((l) => l.token !== token))
      else showToast('Failed to revoke link', 'error')
    } catch {
      showToast('Failed to revoke link', 'error')
    } finally {
      setRevokingToken(null)
    }
  }

  const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'
  const showTestTools = isTestMode

  const googleCalendar = integrations.find((a) => a.source === 'google_calendar')

  const handleConnectGoogle = () => {
    window.location.href = '/api/auth/google-calendar'
  }

  const handleDisconnect = async (source: string) => {
    setDisconnecting(source)
    try {
      const res = await fetch(`/api/integrations/${source}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken ?? '' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Disconnect failed')
      }
      setIntegrations((prev) => prev.filter((a) => a.source !== source))
      showToast('Disconnected', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to disconnect', 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleSyncGoogle = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken ?? '' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Sync failed')
      }
      const data = await res.json() as { imported?: number }
      showToast(`Synced — ${data.imported ?? 0} new events imported`, 'success')
      setIntegrations((prev) => prev.map((a) =>
        a.source === 'google_calendar' ? { ...a, lastSynced: new Date() } : a
      ))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed'
      if (msg.includes('reconnect')) {
        showToast('Google Calendar token expired — reconnect to continue syncing', 'error')
      } else {
        showToast(msg, 'error')
      }
    } finally {
      setSyncing(false)
    }
  }

  const handleResetTestData = async () => {
    setResetting(true)
    try {
      const res = await fetch('/api/test/reset', { method: 'POST', headers: { 'x-csrf-token': csrfToken ?? '' } })
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
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken ?? ''},
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
    if (!currentPassword || !newPassword || newPassword.length < 8) return
    setSaving(true)
    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken ?? ''},
        body: JSON.stringify({ currentPassword, password: newPassword }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Failed to update password')
      }
      setCurrentPassword('')
      setNewPassword('')
      setShowPasswordForm(false)
      showToast('Password updated', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to update password', 'error')
    }
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'x-csrf-token': csrfToken ?? ''},
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
            window.location.href = '/profile/edit'
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

      <SectionLabel>Integrations</SectionLabel>
      <SettingsGroup>
        {/* Google Calendar */}
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="4" width="18" height="17" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
              <path d="M3 9h18" stroke="#4285F4" strokeWidth="1.5"/>
              <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
              <rect x="7" y="13" width="4" height="3" rx="0.5" fill="#34A853" opacity="0.8"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-[#e2e8f0] font-medium">Google Calendar</span>
              {googleCalendar && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-[#6EE7B7]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6EE7B7] shrink-0" />
                  Connected
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#5B6785] mt-0.5 leading-snug">
              {googleCalendar
                ? `Last synced ${googleCalendar.lastSynced ? new Date(googleCalendar.lastSynced).toLocaleDateString() : 'never'}`
                : 'Import health appointments automatically'}
            </div>
            {googleCalendar?.expiresAt && new Date(googleCalendar.expiresAt) < new Date() && (
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FCD34D] shrink-0" />
                <span className="text-[11px] text-[#FCD34D]">Token expired — reconnect to resume syncing</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            {googleCalendar ? (
              <>
                <button
                  onClick={handleSyncGoogle}
                  disabled={syncing}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.06] text-[#e2e8f0] hover:bg-white/[0.1] transition-colors disabled:opacity-40"
                >
                  {syncing ? 'Syncing…' : 'Sync'}
                </button>
                <button
                  onClick={() => handleDisconnect('google_calendar')}
                  disabled={disconnecting === 'google_calendar'}
                  className="text-xs px-3 py-1.5 rounded-lg text-[#FCA5A5] hover:bg-white/[0.06] transition-colors disabled:opacity-40"
                >
                  {disconnecting === 'google_calendar' ? '…' : 'Disconnect'}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleConnectGoogle}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#6366F1] text-white font-semibold hover:bg-[#818CF8] transition-colors"
                >
                  Connect
                </button>
                <InfoTooltip content="Connecting Google Calendar automatically imports appointments — no manual entry needed." />
              </div>
            )}
          </div>
        </div>

        {/* Apple Health */}
        <div className="px-4 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 21C12 21 4 15.5 4 9.5C4 7.01 5.99 5 8.5 5C10 5 11.5 5.75 12 7C12.5 5.75 14 5 15.5 5C18.01 5 20 7.01 20 9.5C20 15.5 12 21 12 21Z" stroke="#FC3158" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-[#e2e8f0] font-medium">Apple Health</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-[#5B6785] font-medium tracking-wide">iOS only</span>
            </div>
            <div className="text-[11px] text-[#5B6785] mt-0.5 leading-snug">Syncs medications, labs, and appointments from Health Records</div>
          </div>
        </div>
      </SettingsGroup>

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
                  headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken ?? ''},
                  body: JSON.stringify({ ai_personality: val }),
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
          <label className="text-[#94a3b8] text-xs mb-1.5 block" htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[#e2e8f0] text-sm mb-3 outline-none focus:border-[#A78BFA]/40 transition-colors"
          />
          <label className="text-[#94a3b8] text-xs mb-1.5 block" htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Min 8 characters"
            minLength={8}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-[#e2e8f0] text-sm mb-3 outline-none focus:border-[#A78BFA]/40 transition-colors"
          />
          {newPassword.length > 0 && newPassword.length < 8 && (
            <p className="text-[#ef4444] text-xs mb-2">Password must be at least 8 characters</p>
          )}
          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || newPassword.length < 8}
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

      <SectionLabel>Active Share Links</SectionLabel>
      <SettingsGroup>
        {shareLinks.length === 0 ? (
          <div className="px-4 py-3.5 text-sm text-[#64748b]">No active share links</div>
        ) : shareLinks.map((link) => (
          <div key={link.token} className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-[#e2e8f0] truncate">{link.title || link.type}</p>
              <p className="text-xs text-[#64748b] mt-0.5">
                Expires {new Date(link.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => handleRevokeLink(link.token)}
              disabled={revokingToken === link.token}
              className="flex-shrink-0 text-xs text-[#ef4444] font-medium hover:opacity-70 disabled:opacity-40 transition-opacity"
            >
              {revokingToken === link.token ? 'Revoking…' : 'Revoke'}
            </button>
          </div>
        ))}
      </SettingsGroup>

      <SectionLabel>About</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          label="App Version"
          right={<span className="text-[#64748b] text-sm">{process.env.NEXT_PUBLIC_APP_VERSION ?? '0.3.1.0'}</span>}
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
