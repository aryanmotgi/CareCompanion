'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { easing } from '@carecompanion/design-tokens';
import { useReducedMotion } from './useReducedMotion';

interface FadeInProps extends Omit<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition'> {
  delayMs?: number;
  durationMs?: number;
  y?: number;
  children: ReactNode;
}

export function FadeIn({ delayMs = 0, durationMs = 420, y = 8, children, ...rest }: FadeInProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0.001 : durationMs / 1000,
        delay: reduced ? 0 : delayMs / 1000,
        ease: easing.appleEase,
      }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
