'use client';

import { motion } from 'framer-motion';
import { ProgressRing } from '@/components/motion';

const MEDS = [
  { name: 'Tamoxifen',  dose: '20mg',  emoji: '💊', taken: true },
  { name: 'Anastrozole', dose: '1mg',  emoji: '🟢', taken: true },
  { name: 'Zofran',     dose: '8mg',   emoji: '🟣', taken: false },
];

export function MedsScene() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-6">
      <div className="mb-6">
        <ProgressRing size={120} progress={0.66} label="2/3" />
      </div>
      <div className="w-full max-w-xs space-y-2">
        {MEDS.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.38 + i * 0.13, type: 'spring', stiffness: 110, damping: 12 }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <span className="text-xl" aria-hidden>{m.emoji}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{m.name}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.dose}</div>
            </div>
            <div
              className="h-5 w-5 rounded-full flex items-center justify-center text-xs"
              style={{
                background: m.taken ? 'var(--emerald-glow)' : 'transparent',
                border: `1px solid ${m.taken ? 'var(--emerald)' : 'var(--border)'}`,
                color: 'var(--emerald)',
              }}
            >
              {m.taken ? '✓' : ''}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
