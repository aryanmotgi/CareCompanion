'use client';

import { motion } from 'framer-motion';

export function ChatScene() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-6 gap-3">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="self-end max-w-[78%] rounded-2xl rounded-br-md px-4 py-2.5"
        style={{
          background: 'linear-gradient(135deg, #A78BFA 0%, #818CF8 100%)',
          color: 'var(--text)',
        }}
      >
        <span className="text-sm">Should I take Zofran with food?</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ delay: 0.9, duration: 1.6, times: [0, 0.15, 0.85, 1] }}
        className="self-start max-w-[40%] rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--lavender)' }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
          />
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.6, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
        className="self-start max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
      >
        <span className="text-sm leading-relaxed">
          Yes — Zofran is best taken with a light snack to prevent nausea breakthrough. Your next dose is in 4 hours.
        </span>
      </motion.div>
    </div>
  );
}
