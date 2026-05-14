'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FadeIn, GradientButton, PhoneFrame } from '@/components/motion';

interface HealthConnectProps {
  onContinue: () => void;
  onBack?: () => void;
}

const STEPS = [
  {
    badge: '1',
    title: 'Open Apple Health',
    body: 'Tap the Health app on your iPhone.',
    mockup: <ProfileMockup />,
  },
  {
    badge: '2',
    title: 'Tap Health Records',
    body: 'Profile → Summary → Health Records.',
    mockup: <RecordsMockup />,
  },
  {
    badge: '3',
    title: 'Search and connect',
    body: 'Find your hospital and grant CareCompanion read access.',
    mockup: <SearchMockup />,
  },
];

export function HealthConnect({ onContinue, onBack }: HealthConnectProps) {
  const [idx, setIdx] = useState(0);
  const step = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  return (
    <div className="relative flex min-h-[100svh] w-full flex-col" style={{ background: 'var(--bg)' }}>
      <div className="flex-1 px-4 pt-12 pb-6">
        <FadeIn>
          <div className="mx-auto max-w-md text-center mb-6">
            <span
              className="inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold"
              style={{ background: 'var(--accent-light)', color: 'var(--lavender)' }}
            >
              Step {step.badge} of {STEPS.length}
            </span>
            <h1
              className="mt-3 text-xl font-bold tracking-tight"
              style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
            >
              {step.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {step.body}
            </p>
          </div>
        </FadeIn>

        <div className="relative mx-auto max-w-md flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
            >
              {step.mockup}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Go to step ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === idx ? 24 : 6,
                background: i === idx ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 px-6 pb-6 pt-4" style={{ background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <GradientButton onClick={() => (isLast ? onContinue() : setIdx(idx + 1))}>
            {isLast ? 'Connect' : 'Next'}
          </GradientButton>
          {onBack ? <GradientButton variant="ghost" onClick={onBack}>Back</GradientButton> : null}
        </div>
      </div>
    </div>
  );
}

function ProfileMockup() {
  return (
    <PhoneFrame statusBarTitle="Health">
      <div className="flex flex-col items-center px-4 py-6">
        <div className="h-14 w-14 rounded-full" style={{ background: '#FF375F' }} aria-hidden />
        <div className="mt-2 text-white text-sm font-semibold">Your name</div>
        <div className="mt-4 w-full space-y-2">
          {['Summary', 'Browse', 'Sharing'].map((s, i) => (
            <div
              key={s}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
              style={{ background: i === 0 ? '#1C1C1E' : '#0F0F12', color: i === 0 ? '#FF375F' : '#fff' }}
            >
              <span>{s}</span>
              <span style={{ color: i === 0 ? '#FF375F' : '#666' }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

function RecordsMockup() {
  return (
    <PhoneFrame statusBarTitle="Summary">
      <div className="px-4 py-6">
        <div className="mb-3 text-xs uppercase tracking-wide text-white/50">Health Records</div>
        {['Medications', 'Lab Results', 'Conditions', 'Allergies'].map((row, i) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-xl px-3 py-3 text-xs"
            style={{ background: i === 0 ? '#1C1C1E' : 'transparent', color: '#fff', marginBottom: 4 }}
          >
            <span>{row}</span>
            <span style={{ color: '#6366F1' }}>›</span>
          </div>
        ))}
        <div
          className="mt-4 rounded-xl border px-3 py-3 text-xs"
          style={{ borderColor: '#6366F1', color: '#fff' }}
        >
          <strong style={{ color: '#6366F1' }}>Tap Health Records</strong> to add a provider.
        </div>
      </div>
    </PhoneFrame>
  );
}

function SearchMockup() {
  return (
    <PhoneFrame statusBarTitle="Search">
      <div className="px-4 py-6">
        <div
          className="mb-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: '#1C1C1E', color: '#fff' }}
        >
          🔍 your hospital
        </div>
        {['Mass General Brigham', 'Mayo Clinic', 'Cleveland Clinic'].map((row, i) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs"
            style={{ background: i === 0 ? '#1C1C1E' : 'transparent', color: '#fff', marginBottom: 4 }}
          >
            <span>{row}</span>
            <span style={{ color: '#30D158' }}>{i === 0 ? '✓ Connected' : 'Connect'}</span>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}
