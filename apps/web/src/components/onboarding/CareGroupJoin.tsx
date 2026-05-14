'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FadeIn, GradientButton, useReducedMotion } from '@/components/motion';

interface CareGroupJoinProps {
  /** Called when join succeeds. patientName may be null. */
  onJoined: (patientName: string | null) => void;
}

type Mode = 'code' | 'email';

function getCsrf(): string {
  return document.cookie.match(/(^| )cc-csrf-token=([^;]+)/)?.[2] ?? '';
}

function formatCodeInput(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5);
  if (clean.length <= 2) return clean;
  return `${clean.slice(0, 2)}-${clean.slice(2)}`;
}

const EMAIL_POLL_MS = 5_000;
const EMAIL_TIMEOUT_MS = 10 * 60 * 1_000;

export function CareGroupJoin({ onJoined }: CareGroupJoinProps) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('code');
  const [codeInput, setCodeInput] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [waitingPatientName, setWaitingPatientName] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function submitCode() {
    const clean = codeInput.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length !== 5) {
      setError("That code is 5 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const csrf = getCsrf();
      const r = await fetch('/api/care-group/join-by-code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ code: clean }),
      });
      const data = await r.json() as { careGroupId?: string; patientName?: string | null; error?: string };
      if (!r.ok || !data.careGroupId) {
        setError(data.error ?? "That code doesn't match. Double-check with your loved one.");
        return;
      }
      onJoined(data.patientName ?? null);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEmailRequest() {
    if (!/.+@.+\..+/.test(email)) {
      setError("Enter a valid email.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const csrf = getCsrf();
      const r = await fetch('/api/care-group/request-join', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ patientEmail: email }),
      });
      const data = await r.json() as { patientName?: string | null; error?: string };
      if (!r.ok) {
        setError(data.error ?? "Couldn't send the request.");
        return;
      }
      setWaitingPatientName(data.patientName ?? null);
      setWaitingForApproval(true);
      startEmailPolling();
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEmailPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch('/api/care-group/request-join/mine', { credentials: 'include' });
        if (!r.ok) return;
        const data = await r.json() as {
          status?: 'pending' | 'approved' | 'denied';
          careGroupId?: string;
          patientName?: string | null;
        };
        if (data.status === 'approved' && data.careGroupId) {
          stopEmailPolling();
          onJoined(data.patientName ?? waitingPatientName);
        } else if (data.status === 'denied') {
          stopEmailPolling();
          setWaitingForApproval(false);
          setError("They declined the request. Try a code instead.");
          setMode('code');
        }
      } catch {
        // swallow — retry next tick
      }
    }, EMAIL_POLL_MS);
    timeoutRef.current = setTimeout(() => {
      stopEmailPolling();
      setWaitingForApproval(false);
      setError("They haven't responded yet. Try a code or check back later.");
    }, EMAIL_TIMEOUT_MS);
  }

  function stopEmailPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }

  if (waitingForApproval) {
    return (
      <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
        <FadeIn>
          <div
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-light)', boxShadow: 'var(--glow-soft-blue)' }}
          >
            <motion.span
              className="text-3xl"
              animate={reduced ? undefined : { scale: [1, 1.1, 1] }}
              transition={reduced ? undefined : { duration: 1.6, repeat: Infinity }}
              aria-hidden
            >
              ⏳
            </motion.span>
          </div>
          <h1 className="mb-2 text-center text-2xl font-bold" style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}>
            Waiting for {waitingPatientName ?? 'them'} to approve
          </h1>
          <p className="mb-8 max-w-sm text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            We sent them an email. We&apos;ll check back every few seconds. This page is safe to leave open.
          </p>
          <div className="flex w-full max-w-sm flex-col gap-2">
            <GradientButton variant="ghost" onClick={() => { stopEmailPolling(); setWaitingForApproval(false); }}>
              Cancel and try a code
            </GradientButton>
          </div>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh] w-full" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-md flex-col px-6 pt-16 pb-10">
        <FadeIn>
          <h1
            className="mb-2 text-center text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
          >
            Join your loved one&apos;s care circle
          </h1>
          <p className="mb-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter the 5-character code they shared with you, or send a join request by email.
          </p>
        </FadeIn>

        {/* Mode toggle */}
        <div
          className="mb-6 grid grid-cols-2 rounded-full p-1"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {(['code', 'email'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className="rounded-full px-4 py-2 text-xs font-semibold"
              style={{
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              {m === 'code' ? 'Have a code' : 'No code — send request'}
            </button>
          ))}
        </div>

        {mode === 'code' ? (
          <FadeIn delayMs={120}>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--lavender)' }}>
              5-character code
            </label>
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(formatCodeInput(e.target.value))}
              placeholder="AB-CDE"
              autoComplete="one-time-code"
              className="mb-3 w-full rounded-2xl px-5 py-4 text-center text-2xl font-bold tracking-[0.2em]"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-hover)',
                color: 'var(--text)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            />
            <GradientButton onClick={submitCode} loading={submitting} disabled={codeInput.replace(/-/g,'').length < 5}>
              Join care circle
            </GradientButton>
          </FadeIn>
        ) : (
          <FadeIn delayMs={120}>
            <label className="mb-3 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--lavender)' }}>
              Patient&apos;s email
            </label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="mb-3 w-full rounded-2xl px-4 py-3 text-sm"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-hover)',
                color: 'var(--text)',
              }}
            />
            <GradientButton onClick={submitEmailRequest} loading={submitting} disabled={!email}>
              Send join request
            </GradientButton>
          </FadeIn>
        )}

        {error ? (
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--rose)' }}>{error}</p>
        ) : null}
      </div>
    </div>
  );
}
