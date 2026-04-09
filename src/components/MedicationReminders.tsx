'use client';

import { useState, useCallback } from 'react';
import type { ReminderLog } from '@/lib/types';

interface MedicationRemindersProps {
  reminders: ReminderLog[];
}

export function MedicationReminders({ reminders: initial }: MedicationRemindersProps) {
  const [reminders, setReminders] = useState(initial);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = useCallback(async (logId: string, status: 'taken' | 'snoozed' | 'missed') => {
    setLoadingId(logId);
    try {
      const res = await fetch('/api/reminders/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: logId, status }),
      });
      if (!res.ok) throw new Error('Response failed');
      if (status === 'taken') {
        setSuccessId(logId);
        setTimeout(() => setSuccessId(null), 1500);
      }
      setReminders((prev) =>
        prev.map((r) =>
          r.id === logId
            ? { ...r, status: status === 'snoozed' ? 'pending' as const : status, responded_at: new Date().toISOString() }
            : r
        )
      );
    } catch {
      setError('Failed to update — tap to retry');
      setTimeout(() => setError(null), 3000);
    }
    setLoadingId(null);
  }, []);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const pending = reminders.filter((r) => r.status === 'pending');
  const completed = reminders.filter((r) => r.status === 'taken');
  const missed = reminders.filter((r) => r.status === 'missed');

  if (reminders.length === 0) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5" />
            <path d="M10.5 1.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1-3 0v-1z" />
          </svg>
          <h3 className="text-sm font-semibold text-[var(--text)]">Medication Reminders</h3>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" />
              <path d="M9 3.5V2" />
              <path d="M15 3.5V2" />
              <path d="M9.5 10.5h5" />
              <path d="M9.5 14h3" />
            </svg>
          </div>
          <p className="text-sm text-[#94a3b8]">No reminders for today</p>
          <p className="text-xs text-[#64748b] mt-1">
            <a href="/settings" className="text-[#A78BFA] hover:underline">Set up reminders</a> in your care settings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.08] p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5" />
          <path d="M10.5 1.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1-3 0v-1z" />
        </svg>
        <h3 className="text-sm font-semibold text-[var(--text)]">Medication Reminders</h3>
        {pending.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-[#6366F1]/20 text-[#A78BFA] px-2 py-0.5 rounded-full">
            {pending.length} pending
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 mb-2">
          {error}
        </div>
      )}

      <div className="space-y-2.5">
        {/* Pending reminders */}
        {pending.map((r) => (
          <div
            key={r.id}
            className="group rounded-xl bg-white/[0.04] border border-white/[0.08] p-3.5 transition-all duration-200 hover:bg-white/[0.06]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-pulse shrink-0" />
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {r.medication_name}
                  </p>
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1 ml-4">
                  {formatTime(r.scheduled_time)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => respond(r.id, 'missed')}
                  disabled={loadingId === r.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50 min-h-[32px]"
                >
                  {loadingId === r.id ? '...' : 'Miss'}
                </button>
                <button
                  onClick={() => respond(r.id, 'snoozed')}
                  disabled={loadingId === r.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50 min-h-[32px]"
                >
                  {loadingId === r.id ? '...' : 'Snooze'}
                </button>
                <button
                  onClick={() => respond(r.id, 'taken')}
                  disabled={loadingId === r.id}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[32px] ${
                    successId === r.id
                      ? 'bg-emerald-500/30 text-emerald-300 scale-105'
                      : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                  }`}
                >
                  {loadingId === r.id ? '...' : successId === r.id ? 'Done!' : 'Take'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Taken reminders */}
        {completed.map((r) => (
          <div
            key={r.id}
            className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/[0.12] p-3.5 transition-all duration-300"
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <p className="text-sm font-medium text-emerald-400/80 truncate flex-1">
                {r.medication_name}
              </p>
              <span className="text-[10px] text-emerald-500/60 uppercase tracking-wider font-medium">
                Taken
              </span>
            </div>
            <p className="text-xs text-emerald-500/40 mt-1 ml-6">
              {formatTime(r.scheduled_time)}
              {r.responded_at && (
                <> &middot; confirmed {formatTime(r.responded_at)}</>
              )}
            </p>
          </div>
        ))}

        {/* Missed reminders */}
        {missed.map((r) => (
          <div
            key={r.id}
            className="rounded-xl bg-red-500/[0.06] border border-red-500/[0.12] p-3.5 transition-all duration-300"
          >
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6" />
                <path d="M9 9l6 6" />
              </svg>
              <p className="text-sm font-medium text-red-400/80 truncate flex-1">
                {r.medication_name}
              </p>
              <span className="text-[10px] text-red-500/60 uppercase tracking-wider font-medium">
                Missed
              </span>
            </div>
            <p className="text-xs text-red-500/40 mt-1 ml-6">
              {formatTime(r.scheduled_time)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
