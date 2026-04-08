'use client';

import { ButtonHTMLAttributes, useState, useCallback } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
}

interface RippleItem {
  id: number
  x: number
  y: number
  size: number
}

export function Button({ variant = 'primary', loading = false, children, className = '', disabled, onClick, ...props }: ButtonProps) {
  const [ripples, setRipples] = useState<RippleItem[]>([])

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    const id = Date.now()

    setRipples((prev) => [...prev, { id, x, y, size }])
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600)

    onClick?.(e)
  }, [onClick])

  const base = 'inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] px-6 py-3 relative overflow-hidden';

  const variants = {
    primary: 'bg-[#6366F1] text-white hover:bg-[#818CF8] hover:shadow-lg hover:shadow-indigo-500/20 focus:ring-indigo-500/30',
    secondary: 'bg-[var(--bg-elevated)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--border)] hover:border-[var(--border-hover)] focus:ring-slate-500/20',
    danger: 'bg-red-600 text-white hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 focus:ring-red-500/30',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      {...props}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-effect"
          style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
        />
      ))}
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
