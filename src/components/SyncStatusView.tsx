'use client'

import { useState, useEffect, useCallback } from 'react'

interface ConnectedApp {
  id: string
  provider: string
  label?: string
  status?: string
  last_synced?: string
  created_at?: string
}

interface SyncError {
  action: string
  details: string | Record<string, unknown>
  created_at: string
}

interface CronJob {
  name: string
  schedule: string
  path: string
}

interface SyncStatusData {
  connected_apps: ConnectedApp[]
  recent_errors: SyncError[]
  cron_schedule: CronJob[]
}

function getStatusColor(lastSynced?: string): { color: string; label: string } {
  if (!lastSynced) return { color: '#ef4444', label: 'Never synced' }
  const hoursAgo = (Date.now() - new Date(lastSynced).getTime()) / (1000 * 60 * 60)
  if (hoursAgo < 24) return { color: '#22c55e', label: 'Synced recently' }
  if (hoursAgo < 72) return { color: '#eab308', label: 'Sync may be stale' }
  return { color: '#ef4444', label: 'Sync overdue' }
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function providerColor(provider: string): string {
  const p = provider.toLowerCase()
  if (p.includes('google') || p.includes('calendar')) return '#60A5FA'
  if (p.includes('fhir') || p.includes('1up') || p.includes('health')) return '#A78BFA'
  if (p.includes('insurance')) return '#34D399'
  return '#94A3B8'
}

export function SyncStatusView() {
  const [data, setData] = useState<SyncStatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/status')
      if (!res.ok) throw new Error('Failed to fetch sync status')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSyncNow = async (appId: string) => {
    setSyncing(appId)
    try {
      const res = await fetch('/api/sync/all', { method: 'POST' })
      if (!res.ok) throw new Error('Sync failed')
      // Refresh status after sync
      await fetchStatus()
    } catch {
      setError('Sync request failed. Please try again.')
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold text-[var(--text)]">Sync Status</h1>
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
            <div className="h-3 bg-white/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold text-[var(--text)] mb-4">Sync Status</h1>
        <div className="glass-card p-4 text-center">
          <p className="text-[var(--text-muted)]">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchStatus() }}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const apps = data?.connected_apps || []
  const errors = data?.recent_errors || []
  const crons = data?.cron_schedule || []

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-[var(--text)]">Sync Status</h1>

      {error && (
        <div className="glass-card p-3 border border-red-500/30" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Connected Apps */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Connected Data Sources
        </h2>
        {apps.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
            </div>
            <p className="text-[var(--text)] font-medium mb-1">No connected accounts</p>
            <p className="text-[var(--text-muted)] text-sm mb-3">
              Connect your health systems, calendar, or insurance to start syncing data.
            </p>
            <a
              href="/connect"
              className="inline-block px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Connect Account
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {apps.map((app) => {
              const status = getStatusColor(app.last_synced)
              const isSyncing = syncing === app.id
              return (
                <div key={app.id} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: providerColor(app.provider) + '20' }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: providerColor(app.provider) }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text)] font-medium text-sm truncate">
                            {app.label || app.provider}
                          </span>
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: status.color }}
                            title={status.label}
                            aria-label={status.label}
                          />
                        </div>
                        <p className="text-[var(--text-muted)] text-xs mt-0.5">
                          Last synced: {formatTime(app.last_synced)}
                        </p>
                        {app.status && app.status !== 'active' && (
                          <p className="text-xs text-yellow-400 mt-0.5">
                            Status: {app.status}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSyncNow(app.id)}
                      disabled={isSyncing}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 transition-colors"
                      style={{
                        background: isSyncing ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                        color: isSyncing ? 'var(--text-muted)' : 'var(--text)',
                        cursor: isSyncing ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Cron Schedule */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Automated Sync Schedule
        </h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left p-3 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wide">
                  Job
                </th>
                <th className="text-left p-3 text-[var(--text-muted)] font-medium text-xs uppercase tracking-wide">
                  Schedule
                </th>
              </tr>
            </thead>
            <tbody>
              {crons.map((cron) => (
                <tr
                  key={cron.path}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <td className="p-3 text-[var(--text)]">{cron.name}</td>
                  <td className="p-3 text-[var(--text-muted)]">{cron.schedule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Sync Errors */}
      {errors.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Recent Sync Issues
          </h2>
          <div className="space-y-2">
            {errors.map((err, i) => (
              <div
                key={`${err.action}-${i}`}
                className="glass-card p-3"
                style={{ borderLeft: '3px solid #ef4444' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text)] font-medium">
                      {err.action.replace('sync_', '').replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                      {typeof err.details === 'string'
                        ? err.details
                        : JSON.stringify(err.details)}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                    {formatTime(err.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
