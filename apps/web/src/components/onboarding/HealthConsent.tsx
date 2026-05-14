'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FadeIn, GradientButton, useReducedMotion } from '@/components/motion';

interface HealthConsentProps {
  onAccepted: () => void;
  onBack?: () => void;
}

interface DataItem {
  emoji: string;
  label: string;
  color: string;
}

const READS: DataItem[] = [
  { emoji: '💊', label: 'Medications',  color: '#6366F1' },
  { emoji: '🩺', label: 'Conditions',   color: '#8B5CF6' },
  { emoji: '🧪', label: 'Lab results',  color: '#A78BFA' },
  { emoji: '📅', label: 'Appointments', color: '#C4B5FD' },
];

const DOES = [
  'Suggest the next medication to take',
  'Help you prep questions for your oncology team',
  'Track adherence and side effects',
];

const DOES_NOT = [
  'Share your data with insurers, employers, or advertisers',
  'Sell or monetize your health information',
  'Make medical decisions for you',
];

export function HealthConsent({ onAccepted, onBack }: HealthConsentProps) {
  const reduced = useReducedMotion();
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="relative min-h-[100svh] w-full" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-md px-6 pt-12 pb-32">
        <FadeIn>
          <div className="mb-6 flex justify-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
              style={{
                background: 'var(--accent-light)',
                boxShadow: 'var(--glow-soft-blue)',
              }}
              aria-hidden
            >
              🛡️
            </div>
          </div>
          <h1
            className="mb-2 text-center text-2xl font-bold tracking-tight"
            style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
          >
            Health Data Access
          </h1>
          <p
            className="mb-8 text-center text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            We&apos;re going to look at your health records. Here&apos;s exactly what that means.
          </p>
        </FadeIn>

        <FadeIn delayMs={150}>
          <Section title="What we read">
            <div className="grid grid-cols-2 gap-2">
              {READS.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md"
                    style={{ background: `${r.color}22` }}
                    aria-hidden
                  >
                    <span>{r.emoji}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text)' }}>{r.label}</span>
                </div>
              ))}
            </div>
          </Section>
        </FadeIn>

        <FadeIn delayMs={250}>
          <Section title="What we do">
            <ul className="space-y-2">
              {DOES.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
                  <span style={{ color: 'var(--emerald)' }} aria-hidden>✓</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{line}</span>
                </li>
              ))}
            </ul>
          </Section>
        </FadeIn>

        <FadeIn delayMs={350}>
          <Section title="What we never do">
            <ul className="space-y-2">
              {DOES_NOT.map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
                  <span style={{ color: 'var(--rose)' }} aria-hidden>✕</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{line}</span>
                </li>
              ))}
            </ul>
          </Section>
        </FadeIn>

        <FadeIn delayMs={450}>
          <div
            className="mb-8 rounded-2xl p-4 text-xs leading-relaxed"
            style={{
              background: 'var(--lavender-light)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <strong style={{ color: 'var(--lavender)' }}>HIPAA-aligned.</strong> CareCompanion meets US healthcare
            privacy standards. Your data is encrypted at rest and in transit. You can revoke access from settings
            at any time.
          </div>
        </FadeIn>

        <FadeIn delayMs={550}>
          <label className="mb-4 flex cursor-pointer items-start gap-3" htmlFor="hc-consent">
            <motion.span
              animate={agreed ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={reduced ? { duration: 0.001 } : { duration: 0.3, type: 'spring', stiffness: 200, damping: 12 }}
              className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md"
              style={{
                background: agreed ? 'var(--accent)' : 'transparent',
                border: `1px solid ${agreed ? 'var(--accent)' : 'var(--border-hover)'}`,
              }}
              aria-hidden
            >
              {agreed ? <span style={{ color: 'var(--text)', fontSize: 12 }}>✓</span> : null}
            </motion.span>
            <input
              id="hc-consent"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>
              I understand and agree to share my health data with CareCompanion.
            </span>
          </label>
        </FadeIn>
      </div>

      {/* Sticky footer */}
      <div
        className="sticky bottom-0 left-0 right-0 px-6 pb-6 pt-4"
        style={{
          background: 'linear-gradient(to top, var(--bg) 60%, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <GradientButton onClick={onAccepted} disabled={!agreed}>
            Continue
          </GradientButton>
          {onBack ? (
            <GradientButton variant="ghost" onClick={onBack}>
              Back
            </GradientButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--lavender)' }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
