'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

interface Orb {
  color: string;
  size: number;
  top: string;
  left: string;
  durationS: number;
}

const ORBS: Orb[] = [
  { color: 'rgba(129, 140, 248, 0.35)', size: 96, top: '8%',  left: '12%', durationS: 18 },
  { color: 'rgba(192, 132, 252, 0.30)', size: 72, top: '60%', left: '78%', durationS: 22 },
  { color: 'rgba(103, 232, 249, 0.25)', size: 60, top: '78%', left: '18%', durationS: 24 },
  { color: 'rgba(167, 139, 250, 0.30)', size: 80, top: '30%', left: '82%', durationS: 20 },
];

export function DriftOrbs({ opacity = 0.5 }: { opacity?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            filter: 'blur(28px)',
            opacity,
          }}
          animate={{
            x: [0, 16, -8, 12, 0],
            y: [0, -14, 10, -6, 0],
          }}
          transition={{ duration: orb.durationS, ease: 'easeInOut', repeat: Infinity }}
        />
      ))}
    </div>
  );
}
