'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Role } from '@/lib/onboarding/phase-machine';

interface RolePickerProps {
  careProfileId: string | null;
  onSelected: (role: Role) => void;
}

interface OptionDef {
  value: Role;
  title: string;
  body: string;
  accent: string;
  icon: React.ReactNode;
}

const ICON_SIZE = 28;

const OPTIONS: OptionDef[] = [
  {
    value: 'patient',
    title: "I'm a patient",
    body: 'Manage your medications, appointments, and care team — with help from an AI companion that knows your case.',
    accent: '#818CF8',
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    ),
  },
  {
    value: 'caregiver',
    title: "I'm a caregiver",
    body: "Join a patient's care circle to keep up with their medications, appointments, and how they're doing.",
    accent: '#C084FC',
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" />
        <circle cx="17" cy="9" r="2.6" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M14.5 14.5c1-.6 2.1-.9 3.3-.9 2.4 0 4.2 1.6 4.2 4.4" />
      </svg>
    ),
  },
  {
    value: 'self',
    title: "I'm tracking my own care",
    body: 'Preventive monitoring, survivorship, or general wellness — sync your health data and let AI surface what matters.',
    accent: '#34D399',
    icon: (
      <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5c-1.2-1.6-3.5-1.6-4.5 0-1 1.6 0 3.4 1.5 4.5L12 14l3-2c1.5-1.1 2.5-2.9 1.5-4.5-1-1.6-3.3-1.6-4.5 0Z" />
      </svg>
    ),
  },
];

export function RolePicker({ careProfileId, onSelected }: RolePickerProps) {
  const { update } = useSession();
  const [submitting, setSubmitting] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(role: Role) {
    if (submitting) return;
    setSubmitting(role);
    setError(null);
    try {
      const csrfMatch = document.cookie.match(/(^| )cc-csrf-token=([^;]+)/);
      const csrfToken = csrfMatch ? csrfMatch[2] : '';
      const res = await fetch('/api/auth/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        setError("Couldn't save that — try once more.");
        return;
      }
      try { localStorage.setItem('cc_user_role', role); } catch { /* private browsing */ }
      await update({ role });

      if (careProfileId) {
        const relationship = role === 'self' ? 'self' : role === 'patient' ? 'patient' : 'caregiver';
        await fetch(`/api/care-profiles/${careProfileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ relationship }),
        });
      }
      onSelected(role);
    } catch {
      setError("Couldn't save that — try once more.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 pt-16 pb-12"
      style={{ background: 'var(--bg, #0C0E1A)' }}
    >
      <div className="w-full max-w-md flex flex-col gap-10">
        {/* Header */}
        <div className="text-center">
          <h1
            className="font-display text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text, #EDE9FE)' }}
          >
            Who are you?
          </h1>
          <p
            className="mt-3 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary, #A5B4CF)' }}
          >
            Tell us a little about your situation so we can personalize CareCompanion.
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4">
          {OPTIONS.map((opt) => {
            const isBusy = submitting === opt.value;
            const dimmed = submitting !== null && !isBusy;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                disabled={submitting !== null}
                className="group relative flex items-start gap-4 rounded-2xl p-5 text-left transition-all duration-200 active:scale-[0.985]"
                style={{
                  background: `linear-gradient(135deg, ${opt.accent}14 0%, rgba(255,255,255,0.02) 100%)`,
                  border: `1px solid ${opt.accent}33`,
                  boxShadow: isBusy
                    ? `0 0 32px ${opt.accent}55, inset 0 0 0 1px ${opt.accent}66`
                    : '0 2px 12px rgba(0,0,0,0.25)',
                  opacity: dimmed ? 0.5 : 1,
                  cursor: submitting ? 'progress' : 'pointer',
                }}
              >
                {/* Icon */}
                <div
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `${opt.accent}22`,
                    border: `1px solid ${opt.accent}55`,
                    color: opt.accent,
                    boxShadow: `0 0 16px ${opt.accent}33`,
                  }}
                  aria-hidden="true"
                >
                  {opt.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-semibold" style={{ color: 'var(--text, #EDE9FE)' }}>
                    {opt.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary, #A5B4CF)' }}>
                    {opt.body}
                  </p>
                </div>

                {/* Trailing */}
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center" aria-hidden="true">
                  {isBusy ? (
                    <span
                      className="h-4 w-4 animate-spin rounded-full border-2"
                      style={{ borderColor: `${opt.accent}33`, borderTopColor: opt.accent }}
                    />
                  ) : (
                    <span className="text-lg" style={{ color: opt.accent }}>→</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="text-center text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        ) : null}

        <div
          className="flex items-center justify-center gap-2 text-xs"
          style={{ color: 'rgba(255,255,255,0.3)' }}
        >
          <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
            <rect x="1" y="5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          HIPAA-aligned. Private and secure.
        </div>
      </div>
    </div>
  );
}
