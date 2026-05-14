'use client';

import { motion } from 'framer-motion';
import { useReducedMotion } from '@/components/motion';

export function TrialsScene() {
  const reduced = useReducedMotion();
  const blips = [
    { angle: 30,  dist: 0.55, delay: 0.4 },
    { angle: 110, dist: 0.78, delay: 0.7 },
    { angle: 200, dist: 0.45, delay: 1.0 },
    { angle: 280, dist: 0.85, delay: 1.3 },
  ];

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Concentric rings */}
      <div className="relative h-64 w-64">
        {[1, 0.7, 0.4].map((r, i) => (
          <div
            key={i}
            className="absolute inset-0 m-auto rounded-full"
            style={{
              width: `${100 * r}%`,
              height: `${100 * r}%`,
              border: '1px solid rgba(167,139,250,0.18)',
            }}
          />
        ))}

        {/* Center dot */}
        <div
          className="absolute inset-0 m-auto h-3 w-3 rounded-full"
          style={{ background: 'var(--accent)', boxShadow: 'var(--glow-blue)' }}
        />

        {/* Sweep */}
        {!reduced && (
          <motion.div
            className="absolute inset-0 origin-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 320deg, rgba(167,139,250,0.25) 350deg, transparent 360deg)',
              borderRadius: '50%',
              maskImage: 'radial-gradient(circle, transparent 0%, black 8%, black 100%)',
              WebkitMaskImage: 'radial-gradient(circle, transparent 0%, black 8%, black 100%)',
            }}
          />
        )}

        {/* Blips */}
        {blips.map((b, i) => {
          const rad = (b.angle * Math.PI) / 180;
          const half = 128;
          const x = half + Math.cos(rad) * half * b.dist;
          const y = half + Math.sin(rad) * half * b.dist;
          return (
            <motion.div
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                left: x - 4,
                top: y - 4,
                background: 'var(--cyan)',
                boxShadow: 'var(--glow-cyan)',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.4, 1], opacity: [0, 1, 1] }}
              transition={{ delay: b.delay, duration: 0.6 }}
            />
          );
        })}
      </div>
    </div>
  );
}
