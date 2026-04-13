'use client';

import { useState, useEffect, useCallback } from 'react';

const SNOOZE_KEY = 'connect_health_snoozed_until';
const SNOOZE_DAYS = 7;

interface ConnectHealthModalProps {
  show: boolean;
}

export function ConnectHealthModal({ show }: ConnectHealthModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!show) return;

    // Check if snoozed
    const snoozedUntil = localStorage.getItem(SNOOZE_KEY);
    if (snoozedUntil && Date.now() < parseInt(snoozedUntil, 10)) return;

    // Small delay so the dashboard renders first
    const t = setTimeout(() => setIsOpen(true), 1200);
    return () => clearTimeout(t);
  }, [show]);

  const handleClose = useCallback(() => {
    const until = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(SNOOZE_KEY, String(until));
    setIsOpen(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); },
    [handleClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="connect-health-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={handleClose} />

      {/* Sheet — slides up from bottom on mobile, centered on desktop */}
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden"
        style={{ backgroundColor: '#0d1117', border: '1px solid rgba(167, 139, 250, 0.15)' }}
      >
        {/* Purple glow at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full bg-violet-500/20 blur-[60px] pointer-events-none" />

        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[#94a3b8] hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-5 pb-7">
          {/* Icon */}
          <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto" style={{ backgroundColor: 'rgba(167, 139, 250, 0.12)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
            <div className="absolute inset-0 rounded-2xl bg-violet-500/10 blur-md" />
            <svg className="relative w-7 h-7 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
          </div>

          {/* Headline */}
          <h2 id="connect-health-title" className="text-xl font-bold text-white text-center mb-1.5">
            Connect your health records
          </h2>
          <p className="text-sm text-[#94a3b8] text-center mb-6 leading-relaxed">
            Sync your data from 700+ health systems — Kaiser, MyChart, Aetna, Medicare, and more.
          </p>

          {/* Benefits */}
          <ul className="space-y-3 mb-7">
            {[
              { icon: '💊', label: 'Medications & refills auto-imported' },
              { icon: '🧪', label: 'Lab results & trends tracked automatically' },
              { icon: '📅', label: 'Upcoming appointments synced' },
              { icon: '🏥', label: 'Insurance claims & coverage in one place' },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-3">
                <span className="text-base w-6 text-center flex-shrink-0">{item.icon}</span>
                <span className="text-sm text-[#cbd5e1]">{item.label}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a
            href="/connect"
            className="block w-full text-center gradient-btn text-white font-semibold text-sm py-3.5 px-6 rounded-xl"
          >
            Connect health records
          </a>
          <button
            onClick={handleClose}
            className="block w-full text-center text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors mt-3 py-1"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
