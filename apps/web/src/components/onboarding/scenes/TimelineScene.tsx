'use client';

import { motion } from 'framer-motion';

const NODES = [
  { label: 'Diagnosed', color: 'var(--text-muted)', done: true },
  { label: 'Treatment', color: 'var(--lavender)',  done: true },
  { label: 'Now',       color: 'var(--accent)',    done: false, current: true },
  { label: 'Remission', color: 'var(--emerald)',   done: false },
];

export function TimelineScene() {
  return (
    <div className="relative flex h-full w-full items-center justify-center px-4">
      <div className="relative flex w-full max-w-xs items-center justify-between">
        {/* Track */}
        <div
          className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2"
          style={{ background: 'var(--border)' }}
        />
        {/* Progress fill */}
        <motion.div
          className="absolute left-2 top-1/2 h-px -translate-y-1/2"
          style={{
            background: 'linear-gradient(90deg, var(--lavender), var(--accent))',
            width: 'calc((100% - 16px) * 0.5)',
            transformOrigin: 'left center',
          }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.45, duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
        />

        {NODES.map((n, i) => (
          <motion.div
            key={n.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.18, duration: 0.42 }}
            className="relative z-10 flex flex-col items-center gap-2"
          >
            <motion.div
              className="h-3 w-3 rounded-full"
              style={{
                background: n.done || n.current ? n.color : 'var(--bg-warm)',
                border: `2px solid ${n.color}`,
                boxShadow: n.current ? 'var(--glow-blue)' : 'none',
              }}
              animate={n.current ? { scale: [1, 1.25, 1] } : undefined}
              transition={n.current ? { duration: 1.8, repeat: Infinity } : undefined}
            />
            <span className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              {n.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
