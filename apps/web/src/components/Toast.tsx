'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}

const dotColors: Record<ToastProps['type'], string> = {
  success: 'bg-[#6EE7B7]',
  error: 'bg-[#ef4444]',
  info: 'bg-[#A78BFA]',
};

export function Toast({ message, type, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-up animation on mount
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transition-all duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div role="alert" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-warm)]/95 px-4 py-3 shadow-lg backdrop-blur-xl">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${dotColors[type]}`}
          aria-hidden="true"
        />
        <span className="text-sm text-white">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 shrink-0 text-white/50 transition-colors hover:text-white"
          aria-label="Dismiss"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
