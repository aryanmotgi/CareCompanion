'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FadeIn, GradientButton, useReducedMotion } from '@/components/motion';

interface ShareInviteProps {
  careGroupId: string | null;
  patientName?: string;
  onContinue: () => void;
  onSkip: () => void;
}

interface CodeResponse {
  code?: string;
  error?: string;
}

function formatCode(raw: string): string {
  const clean = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5);
  if (clean.length <= 2) return clean;
  return `${clean.slice(0, 2)}-${clean.slice(2)}`;
}

export function ShareInvite({ careGroupId, patientName, onContinue, onSkip }: ShareInviteProps) {
  const reduced = useReducedMotion();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchCode = useCallback(async () => {
    if (!careGroupId) {
      setLoading(false);
      setError('Care group not ready yet.');
      return;
    }
    try {
      const r = await fetch(`/api/care-group/code?careGroupId=${encodeURIComponent(careGroupId)}`, {
        credentials: 'include',
      });
      if (r.ok) {
        const data = (await r.json()) as CodeResponse;
        if (data.code) {
          setCode(data.code);
          return;
        }
      }
      // No code yet — request one
      const csrf = (document.cookie.match(/cc-csrf-token=([^;]+)/) ?? [])[1] ?? '';
      const gen = await fetch('/api/care-group/code', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ careGroupId }),
      });
      const data = (await gen.json()) as CodeResponse;
      if (data.code) setCode(data.code);
      else setError(data.error ?? "Couldn't get a code.");
    } catch {
      setError("Couldn't fetch a code.");
    } finally {
      setLoading(false);
    }
  }, [careGroupId]);

  useEffect(() => {
    void fetchCode();
  }, [fetchCode]);

  async function regenerate() {
    if (!careGroupId) return;
    setRegenerating(true);
    try {
      const csrf = (document.cookie.match(/cc-csrf-token=([^;]+)/) ?? [])[1] ?? '';
      const r = await fetch('/api/care-group/code/rotate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ careGroupId }),
      });
      const data = (await r.json()) as CodeResponse;
      if (data.code) setCode(data.code);
    } catch {
      setError("Couldn't regenerate.");
    } finally {
      setRegenerating(false);
    }
  }

  async function share() {
    if (!code) return;
    const shareText = patientName
      ? `Join my CareCompanion care circle for ${patientName}. Code: ${formatCode(code)}`
      : `Join my CareCompanion care circle. Code: ${formatCode(code)}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'CareCompanion invite', text: shareText });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy.");
    }
  }

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full text-3xl"
          style={{
            background: 'linear-gradient(135deg, #A78BFA 0%, #818CF8 100%)',
            boxShadow: 'var(--glow-violet)',
          }}
          aria-hidden
        >
          🤝
        </div>
      </FadeIn>

      <FadeIn delayMs={150}>
        <h1
          className="mb-3 max-w-sm text-center text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
        >
          Invite your care circle
        </h1>
        <p className="mb-8 max-w-sm text-center text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Share this code with family or caregivers — they&apos;ll join your circle in seconds.
        </p>
      </FadeIn>

      <FadeIn delayMs={280}>
        <motion.div
          className="mb-2 flex items-center justify-center rounded-2xl px-8 py-6"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-glow)',
            boxShadow: 'var(--glow-soft-blue)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
          animate={!reduced && !loading && code ? { scale: [1, 1.03, 1] } : undefined}
          transition={!reduced ? { duration: 0.4 } : undefined}
        >
          {loading ? (
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Generating…</span>
          ) : code ? (
            <span className="text-3xl font-bold tracking-[0.2em]" style={{ color: 'var(--text)' }}>
              {formatCode(code)}
            </span>
          ) : (
            <span className="text-sm" style={{ color: 'var(--rose)' }}>{error ?? 'No code'}</span>
          )}
        </motion.div>

        <button
          type="button"
          onClick={regenerate}
          disabled={loading || regenerating || !code}
          className="mb-8 text-xs underline"
          style={{ color: 'var(--text-secondary)', opacity: regenerating ? 0.5 : 1 }}
        >
          {regenerating ? 'Regenerating…' : 'Regenerate code'}
        </button>
      </FadeIn>

      <FadeIn delayMs={420}>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <GradientButton onClick={share} disabled={!code}>
            {copied ? 'Copied to clipboard ✓' : 'Share code'}
          </GradientButton>
          <GradientButton variant="ghost" onClick={onContinue}>
            I&apos;ll do this later
          </GradientButton>
          <button
            type="button"
            onClick={onSkip}
            className="mt-1 text-center text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            Skip and finish
          </button>
        </div>
      </FadeIn>
    </div>
  );
}
