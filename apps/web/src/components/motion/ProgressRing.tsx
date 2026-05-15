'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

interface ProgressRingProps {
  size?: number;
  stroke?: number;
  progress: number; // 0..1
  color?: string;
  trackColor?: string;
  label?: string;
}

export function ProgressRing({
  size = 96,
  stroke = 8,
  progress,
  color = 'var(--accent)',
  trackColor = 'rgba(255,255,255,0.08)',
  label,
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, progress)));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeLinecap="round"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduced ? 0.001 : 1.4, ease: [0.32, 0.72, 0, 1] }}
        />
      </svg>
      {label ? (
        <span
          className="absolute text-sm font-semibold"
          style={{ color: 'var(--text)' }}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
