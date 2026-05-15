'use client';

import { FadeIn, GradientButton, PulseRing } from '@/components/motion';

interface OnboardingRecordsProps {
  onConnect: () => void;
  onSkip: () => void;
}

const BULLETS = [
  'End-to-end encrypted',
  'Never shared without your permission',
  'Granular: turn off any source any time',
];

export function OnboardingRecords({ onConnect, onSkip }: OnboardingRecordsProps) {
  return (
    <div className="relative flex min-h-[100svh] w-full flex-col items-center justify-center px-6" style={{ background: 'var(--bg)' }}>
      <FadeIn>
        <div className="relative mb-8 flex items-center justify-center">
          <PulseRing size={120} color="var(--lavender)" />
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-full text-4xl"
            style={{
              background:
                'linear-gradient(135deg, #A78BFA 0%, #818CF8 60%, #22D3EE 100%)',
              boxShadow: 'var(--glow-violet)',
            }}
            aria-hidden
          >
            🩺
          </div>
        </div>
      </FadeIn>

      <FadeIn delayMs={240}>
        <h1
          className="mb-3 max-w-sm text-center text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
        >
          Connect your health records
        </h1>
      </FadeIn>

      <FadeIn delayMs={360}>
        <p className="mb-8 max-w-sm text-center text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          We&apos;ll pull medications, labs, conditions, and appointments from your healthcare providers — so you don&apos;t have to type them out.
        </p>
      </FadeIn>

      <FadeIn delayMs={480}>
        <ul className="mb-10 flex flex-col gap-3 self-stretch max-w-sm mx-auto">
          {BULLETS.map((line) => (
            <li key={line} className="flex items-center gap-3">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs"
                style={{
                  background: 'var(--accent-light)',
                  color: 'var(--emerald)',
                }}
                aria-hidden
              >
                ✓
              </span>
              <span className="text-sm" style={{ color: 'var(--text)' }}>{line}</span>
            </li>
          ))}
        </ul>
      </FadeIn>

      <FadeIn delayMs={620}>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <GradientButton onClick={onConnect}>Connect records</GradientButton>
          <GradientButton variant="ghost" onClick={onSkip}>
            Skip for now
          </GradientButton>
        </div>
      </FadeIn>
    </div>
  );
}
