'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useReducedMotion } from '@/components/motion';

interface JoinedToastProps {
  joinerName: string | null;
  /** Number of ms to keep the toast visible. Default 4000. */
  durationMs?: number;
  onDismiss?: () => void;
}

export function JoinedToast({ joinerName, durationMs = 4000, onDismiss }: JoinedToastProps) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [durationMs, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="joined-toast"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: 'spring', stiffness: 200, damping: 22 }}
          className="fixed left-1/2 top-6 z-50 -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="flex items-center gap-3 rounded-full px-5 py-3"
            style={{
              background: 'var(--bg-warm)',
              border: '1px solid var(--accent-glow)',
              boxShadow: 'var(--glow-blue)',
            }}
            animate={
              reduced
                ? undefined
                : { boxShadow: ['var(--glow-blue)', 'var(--glow-press-blue)', 'var(--glow-blue)'] }
            }
            transition={reduced ? undefined : { duration: 0.6 }}
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full text-sm"
              style={{
                background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
                color: 'var(--text)',
              }}
              aria-hidden
            >
              ✓
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--lavender)' }}>
                Connected
              </span>
              <span className="text-sm" style={{ color: 'var(--text)' }}>
                {joinerName ? `${joinerName} just joined your care circle` : 'Someone just joined your care circle'}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
