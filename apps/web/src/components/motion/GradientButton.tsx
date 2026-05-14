'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface GradientButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'whileTap' | 'whileHover' | 'transition'> {
  children: ReactNode;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  fullWidth?: boolean;
}

export function GradientButton({
  children,
  variant = 'primary',
  loading = false,
  fullWidth = true,
  disabled,
  style,
  ...rest
}: GradientButtonProps) {
  const reduced = useReducedMotion();
  const isDisabled = disabled || loading;

  if (variant === 'ghost') {
    return (
      <motion.button
        whileTap={reduced ? {} : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        disabled={isDisabled}
        style={{
          width: fullWidth ? '100%' : undefined,
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          color: 'var(--lavender)',
          border: 'none',
          fontFamily: 'Figtree, system-ui, sans-serif',
          fontWeight: 600,
          fontSize: 14,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          opacity: isDisabled ? 0.4 : 1,
          ...style,
        }}
        {...rest}
      >
        {loading ? '…' : children}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={reduced || isDisabled ? {} : { scale: 0.97 }}
      whileHover={reduced || isDisabled ? {} : { boxShadow: 'var(--glow-blue)' }}
      transition={{ type: 'spring', stiffness: 200, damping: 12 }}
      disabled={isDisabled}
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '14px 24px',
        borderRadius: 'var(--radius-md)',
        background: isDisabled
          ? 'rgba(99,102,241,0.25)'
          : 'linear-gradient(135deg, #A78BFA 0%, #818CF8 100%)',
        color: 'var(--text)',
        border: 'none',
        fontFamily: 'Figtree, system-ui, sans-serif',
        fontWeight: 600,
        fontSize: 16,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled && !loading ? 0.5 : 1,
        boxShadow: isDisabled ? 'none' : 'var(--glow-soft-blue)',
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden
          />
          <span>Working…</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
