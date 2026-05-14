'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DriftOrbs, FadeIn, useReducedMotion } from '@/components/motion';
import type { Role } from '@/lib/onboarding/phase-machine';

interface RolePickerProps {
  careProfileId: string | null;
  onSelected: (role: Role) => void;
}

interface OptionDef {
  role: Role;
  emoji: string;
  title: string;
  body: string;
  glow: 'blue' | 'violet' | 'emerald';
  glowColor: string;
}

const OPTIONS: OptionDef[] = [
  {
    role: 'patient',
    emoji: '🫶',
    title: "I'm the patient",
    body: 'Track meds, ask the AI about your case, prep for appointments.',
    glow: 'blue',
    glowColor: '#818CF8',
  },
  {
    role: 'caregiver',
    emoji: '👨‍👩‍👧',
    title: 'I care for someone',
    body: 'Connect to a loved one and see what they need today.',
    glow: 'violet',
    glowColor: '#C084FC',
  },
  {
    role: 'self',
    emoji: '🧠',
    title: 'Just for me',
    body: 'Preventive care and personal health organization.',
    glow: 'emerald',
    glowColor: '#34D399',
  },
];

export function RolePicker({ careProfileId, onSelected }: RolePickerProps) {
  const reduced = useReducedMotion();
  const [submitting, setSubmitting] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(role: Role) {
    setSubmitting(role);
    setError(null);
    try {
      if (careProfileId) {
        // Map to existing relationship vocabulary
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
    <div className="relative min-h-[100svh] w-full overflow-hidden" style={{ background: 'var(--bg)' }}>
      <DriftOrbs opacity={0.35} />

      <div className="relative z-10 mx-auto flex max-w-md flex-col px-6 pt-16 pb-10">
        <FadeIn>
          <h1
            className="mb-2 text-center text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
          >
            Who are you?
          </h1>
          <p
            className="mb-10 text-center text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            We&apos;ll personalize CareCompanion for your situation.
          </p>
        </FadeIn>

        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt, i) => (
            <motion.button
              key={opt.role}
              type="button"
              onClick={() => pick(opt.role)}
              disabled={submitting !== null}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduced ? 0 : 0.25 + i * 0.12,
                duration: 0.6,
                ease: [0.33, 1, 0.68, 1],
              }}
              whileTap={reduced ? {} : { scale: 0.97 }}
              whileHover={
                reduced
                  ? {}
                  : {
                      boxShadow: `0 0 32px ${opt.glowColor}55`,
                      borderColor: `${opt.glowColor}55`,
                    }
              }
              className="relative flex items-center gap-4 rounded-2xl px-5 py-5 text-left"
              style={{
                background: `linear-gradient(135deg, ${opt.glowColor}14 0%, transparent 90%)`,
                border: `1px solid ${opt.glowColor}33`,
                cursor: submitting ? 'progress' : 'pointer',
                opacity: submitting && submitting !== opt.role ? 0.5 : 1,
              }}
            >
              <div
                className="relative flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{
                  background: `${opt.glowColor}22`,
                  border: `1px solid ${opt.glowColor}44`,
                  boxShadow: `0 0 18px ${opt.glowColor}33`,
                }}
                aria-hidden
              >
                {opt.emoji}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                  {opt.title}
                </h2>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {opt.body}
                </p>
              </div>
              {submitting === opt.role ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2"
                  style={{ borderColor: 'var(--border)', borderTopColor: opt.glowColor }}
                />
              ) : (
                <span style={{ color: opt.glowColor }} aria-hidden>
                  →
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {error ? (
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--rose)' }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
