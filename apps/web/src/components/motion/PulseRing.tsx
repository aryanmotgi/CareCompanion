'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

interface PulseRingProps {
  size?: number;
  color?: string;
}

export function PulseRing({ size = 96, color = 'var(--accent)' }: PulseRingProps) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}`,
      }}
      animate={{
        scale: [1, 1.9],
        opacity: [0.2, 0],
      }}
      transition={{
        duration: 1.8,
        ease: 'easeOut',
        repeat: Infinity,
      }}
    />
  );
}
