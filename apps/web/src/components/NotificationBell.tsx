'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Notification } from '@/lib/types';

interface NotificationBellProps {
  initialNotifications: Notification[];
  initialCount: number;
}

const TYPE_DOT_COLORS: Record<string, string> = {
  refill_overdue: '#f87171',
  refill_soon: '#fbbf24',
  appointment_prep: '#60a5fa',
  appointment_today: '#60a5fa',
  prior_auth_expiring: '#fb923c',
  abnormal_lab: '#fbbf24',
  low_balance: '#34d399',
  lab_result: '#a78bfa',
  claim_denied: '#f87171',
  prescription_ready: '#34d399',
};

const TYPE_COLORS: Record<string, string> = {
  refill_overdue: 'bg-red-500/10',
  refill_soon: 'bg-amber-500/10',
  appointment_prep: 'bg-blue-500/10',
  appointment_today: 'bg-blue-500/10',
  prior_auth_expiring: 'bg-orange-500/10',
  abnormal_lab: 'bg-amber-500/10',
  low_balance: 'bg-emerald-500/10',
};

const csrfToken = () => document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? '';

function getChatPrompt(notif: Notification): string {
  switch (notif.type) {
    case 'refill_overdue':
    case 'refill_soon':
      return 'Help me manage my medication refills';
    case 'appointment_prep':
    case 'appointment_today':
      return 'Help me prepare for my upcoming appointment';
    case 'abnormal_lab':
    case 'lab_result':
      return 'Explain my recent lab results';
    case 'prior_auth_expiring':
      return 'Help me understand my prior authorization status';
    case 'claim_denied':
      return 'Help me understand my insurance claim status';
    case 'low_balance':
      return 'Help me manage my FSA or HSA account';
    default:
      return 'Help me understand my care updates';
  }
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell({ initialNotifications, initialCount }: NotificationBellProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        bellButtonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dismiss = async (id: string) => {
    const prev = notifications;
    const prevCount = count;
    setNotifications((n) => n.filter((x) => x.id !== id));
    setCount((c) => Math.max(0, c - 1));
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      setNotifications(prev);
      setCount(prevCount);
    }
  };

  const markAllRead = async () => {
    const prev = notifications;
    const prevCount = count;
    setNotifications([]);
    setCount(0);
    setOpen(false);
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
      body: JSON.stringify({ all: true }),
    });
    if (!res.ok) {
      setNotifications(prev);
      setCount(prevCount);
      setOpen(true);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={bellButtonRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-colors"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-[var(--bg-card)] rounded-2xl shadow-lg border border-[var(--border)] z-[150] overflow-hidden animate-card-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="font-display font-semibold text-white text-sm">Notifications</h3>
            {count > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-medium transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-[var(--text-muted)]">All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-[var(--border)] ${TYPE_COLORS[n.type] || (!n.isRead ? 'bg-blue-500/10' : '')}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: TYPE_DOT_COLORS[n.type] || '#a78bfa' }} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white leading-snug">{n.title}</p>
                      {n.message && (
                        <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{n.message}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <Link
                          href={`/chat?prompt=${encodeURIComponent(getChatPrompt(n))}`}
                          onClick={() => {
                            dismiss(n.id);
                            setOpen(false);
                          }}
                          className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-medium transition-colors"
                        >
                          Ask AI
                        </Link>
                        <button
                          onClick={() => dismiss(n.id)}
                          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                        >
                          Dismiss
                        </button>
                        <span className="text-[10px] text-[var(--text-muted)] ml-auto">{n.createdAt ? timeAgo(n.createdAt.toISOString()) : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <Link href="/notifications" onClick={() => setOpen(false)} className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] font-medium transition-colors flex items-center justify-center gap-1">
              View all notifications
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
