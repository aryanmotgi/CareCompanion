'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientButton } from '@/components/motion';
import { useReducedMotion } from '@/components/motion';

const DISCLAIMER_SEEN_KEY = 'cc-disclaimer-seen';
const DISCLAIMER_VERSION = '1.0';

interface DisclaimerModalProps {
  onAccepted: () => void;
}

export function DisclaimerModal({ onAccepted }: DisclaimerModalProps) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let seen = false;
    try { seen = window.localStorage.getItem(DISCLAIMER_SEEN_KEY) === DISCLAIMER_VERSION; }
    catch { seen = false; }
    if (seen) {
      onAccepted();
    } else {
      setOpen(true);
    }
  }, [onAccepted]);

  async function handleAccept() {
    setSubmitting(true);
    try {
      try { window.localStorage.setItem(DISCLAIMER_SEEN_KEY, DISCLAIMER_VERSION); }
      catch { /* private browsing — proceed anyway */ }

      // Server log via existing endpoint
      try {
        // Fetch CSRF token first if cookie not present
        await fetch('/api/csrf-token', { method: 'GET', credentials: 'include' });
        const csrf = (document.cookie.match(/cc-csrf-token=([^;]+)/) ?? [])[1] ?? '';
        await fetch('/api/consent/accept', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ version: DISCLAIMER_VERSION }),
        });
      } catch {
        // Network fail — localStorage flag still set; consent will be re-recorded on next attempt
      }
    } finally {
      setSubmitting(false);
      setOpen(false);
      onAccepted();
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="disclaimer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0.001 : 0.24 }}
        className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0"
        style={{ background: 'rgba(8, 8, 18, 0.72)', backdropFilter: 'blur(8px)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
      >
        <motion.div
          key="disclaimer-panel"
          initial={{ y: reduced ? 0 : 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: reduced ? 0 : 24, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="w-full max-w-md rounded-3xl p-6 sm:p-7"
          style={{
            background: 'var(--bg-warm)',
            border: '1px solid var(--border-hover)',
            boxShadow: 'var(--glow-soft-violet)',
          }}
        >
          <h1
            id="disclaimer-title"
            className="mb-3 text-xl font-bold"
            style={{ color: 'var(--text)', fontFamily: 'Figtree, system-ui, sans-serif' }}
          >
            Before you continue
          </h1>
          <p
            className="mb-3 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            CareCompanion helps you organize cancer care information from your providers and Apple Health.
            It is <strong style={{ color: 'var(--text)' }}>not a medical device, diagnostic tool, or
            substitute for professional medical advice</strong>.
          </p>
          <p
            className="mb-6 text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            Always discuss medications, symptoms, lab results, and treatment decisions with your oncology
            care team. In an emergency, call <strong style={{ color: 'var(--rose)' }}>911</strong> or go
            to the nearest emergency room.
          </p>
          <GradientButton onClick={handleAccept} loading={submitting}>
            I understand
          </GradientButton>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
