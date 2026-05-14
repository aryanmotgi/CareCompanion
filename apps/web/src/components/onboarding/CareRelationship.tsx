'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FadeIn, GradientButton, useReducedMotion } from '@/components/motion';

interface CareRelationshipProps {
  patientName: string | null;
  onConfirmed: () => void;
}

const OPTIONS = [
  { value: 'spouse',  label: 'Spouse / partner', emoji: '💍' },
  { value: 'parent',  label: 'Parent',           emoji: '👨' },
  { value: 'child',   label: 'Child',            emoji: '🧒' },
  { value: 'sibling', label: 'Sibling',          emoji: '🤝' },
  { value: 'friend',  label: 'Friend',           emoji: '🫂' },
  { value: 'other',   label: 'Other',            emoji: '✨' },
];

export function CareRelationship({ patientName, onConfirmed }: CareRelationshipProps) {
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const csrf = (document.cookie.match(/cc-csrf-token=([^;]+)/) ?? [])[1] ?? '';
      const r = await fetch('/api/care-group/member/relationship', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ relationship: selected }),
      });
      if (!r.ok) throw new Error(await r.text());
      onConfirmed();
    } catch {
      setError("Couldn't save that — try once more.");
    } finally {
      setSubmitting(false);
    }
  }

  const firstName = patientName?.split(' ')[0] ?? 'them';

  return (
    <div className="relative min-h-[100svh] w-full" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-md flex-col px-6 pt-16 pb-10">
        <FadeIn>
          <div className="mb-6 flex justify-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
              style={{
                background: 'var(--accent-light)',
                border: '1px solid var(--accent-glow)',
                boxShadow: 'var(--glow-soft-blue)',
              }}
              aria-hidden
            >
              👤
            </div>
          </div>
        </FadeIn>

        <FadeIn delayMs={150}>
          <h1
            className="mb-2 text-center text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
          >
            You&apos;re caring for {patientName ?? 'them'}
          </h1>
          <p className="mb-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            How are you related to {firstName}? This personalizes the AI.
          </p>
        </FadeIn>

        <div className="grid grid-cols-2 gap-2 mb-8">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 0.2 + i * 0.06 }}
              whileTap={reduced ? {} : { scale: 0.97 }}
              className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center"
              style={{
                background: selected === opt.value ? 'var(--accent-light)' : 'var(--bg-card)',
                border: `1px solid ${selected === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                boxShadow: selected === opt.value ? 'var(--glow-soft-blue)' : 'none',
              }}
            >
              <span className="text-2xl" aria-hidden>{opt.emoji}</span>
              <span className="text-xs" style={{ color: 'var(--text)' }}>{opt.label}</span>
            </motion.button>
          ))}
        </div>

        <GradientButton onClick={submit} disabled={!selected} loading={submitting}>
          Continue
        </GradientButton>
        {error ? (
          <p className="mt-3 text-center text-xs" style={{ color: 'var(--rose)' }}>{error}</p>
        ) : null}
      </div>
    </div>
  );
}
