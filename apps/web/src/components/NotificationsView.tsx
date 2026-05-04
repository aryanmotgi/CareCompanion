'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useToast } from './ToastProvider'
import { useCsrfToken } from './CsrfProvider'
import type { Notification } from '@/lib/types'

function getChatPromptForType(type: string): string {
  switch (type) {
    case 'refill_overdue':
    case 'refill_soon':
      return 'Help me manage my medication refills'
    case 'appointment_prep':
    case 'appointment_today':
      return 'Help me prepare for my upcoming appointment'
    case 'abnormal_lab':
    case 'lab_result':
      return 'Explain my recent lab results'
    case 'prior_auth_expiring':
      return 'Help me understand my prior authorization status'
    case 'claim_denied':
      return 'Help me understand my insurance claim status'
    case 'low_balance':
      return 'Help me manage my FSA or HSA account'
    default:
      return 'Help me understand my care updates'
  }
}

const TYPE_ICONS: Record<string, string> = {
  refill_overdue: '\u{1F534}',
  refill_soon: '\u{1F48A}',
  appointment_prep: '\u{1F4CB}',
  appointment_today: '\u{1F4C5}',
  prior_auth_expiring: '\u{23F0}',
  abnormal_lab: '\u{26A0}\u{FE0F}',
  low_balance: '\u{1F4B0}',
  lab_result: '\u{1F52C}',
  claim_denied: '\u{274C}',
  prescription_ready: '\u{1F48A}',
  cycle_nadir_warning: '\u{1F9EC}',
  cycle_nadir_active: '\u{1F321}\u{FE0F}',
  cycle_recovery: '\u{1F4C8}',
  cycle_pre_infusion: '\u{1F489}',
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'medications', label: 'Medications', types: ['refill_overdue', 'refill_soon', 'prescription_ready'] },
  { key: 'appointments', label: 'Appointments', types: ['appointment_prep', 'appointment_today'] },
  { key: 'labs', label: 'Labs', types: ['abnormal_lab', 'lab_result'] },
  { key: 'insurance', label: 'Insurance', types: ['prior_auth_expiring', 'low_balance', 'claim_denied'] },
  { key: 'treatment', label: 'Treatment', types: ['cycle_nadir_warning', 'cycle_nadir_active', 'cycle_recovery', 'cycle_pre_infusion'] },
]

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

interface NotificationsViewProps {
  notifications: Notification[]
}

export function NotificationsView({ notifications: initial }: NotificationsViewProps) {
  const [notifications, setNotifications] = useState(initial)
  const [activeFilter, setActiveFilter] = useState('all')
  const { showToast } = useToast()
  const csrfToken = useCsrfToken()

  const filtered = notifications.filter((n) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'unread') return !n.isRead
    const tab = FILTER_TABS.find((t) => t.key === activeFilter)
    return tab?.types?.includes(n.type)
  })

  const dismiss = async (id: string) => {
    const prev = notifications
    setNotifications((n) => n.filter((x) => x.id !== id))
    const res = await fetch(`/api/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'x-csrf-token': csrfToken ?? '' },
    })
    if (!res.ok) {
      setNotifications(prev)
      showToast('Failed to dismiss notification', 'error')
    }
  }

  const markAllRead = async () => {
    const prev = notifications
    setNotifications((n) => n.map((x) => ({ ...x, isRead: true })))
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken ?? '' },
      body: JSON.stringify({ all: true }),
    })
    if (!res.ok) {
      setNotifications(prev)
      showToast('Failed to mark notifications as read', 'error')
    } else {
      showToast('All notifications marked as read', 'success')
    }
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <div className="px-5 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-[var(--text)]">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-[var(--lavender)] hover:text-[#C4B5FD] font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)]"
          >
            Mark all read ({unreadCount})
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-5 px-5 scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0 ${
              activeFilter === tab.key
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {filtered.length === 0 && activeFilter === 'all' && (
        <div className="flex flex-col items-center py-10 text-center px-4">
          <div className="w-14 h-14 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center mb-4">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#f1f5f9] mb-1">You won&apos;t miss a thing</p>
          <p className="text-xs text-[#64748b] max-w-xs leading-relaxed">Turn on reminders for medications, appointments, and refills.</p>
        </div>
      )}
      {filtered.length === 0 && activeFilter !== 'all' && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3" aria-hidden="true">🔍</div>
          <p className="text-[var(--text-muted)] text-sm">No {activeFilter} notifications.</p>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-all ${
                !n.isRead
                  ? 'border-[var(--accent-light)] bg-[var(--accent-light)]'
                  : 'border-[var(--border)] bg-[var(--bg-card)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 shrink-0" aria-hidden="true">
                  {TYPE_ICONS[n.type] || '\u{1F514}'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] leading-snug">{n.title}</p>
                  {n.message && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-3">{n.message}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2.5">
                    <Link
                      href={`/chat?prompt=${encodeURIComponent(getChatPromptForType(n.type))}`}
                      className="text-xs text-[var(--lavender)] hover:text-[#C4B5FD] font-medium transition-colors"
                    >
                      Ask AI
                    </Link>
                    <button
                      onClick={() => dismiss(n.id)}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      Dismiss
                    </button>
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                      {n.createdAt ? timeAgo(n.createdAt.toISOString()) : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
