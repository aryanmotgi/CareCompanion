'use client';

import { useEffect, useCallback } from 'react';

interface DataConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsent: () => void;
  consentHref?: string;
}

export function DataConsentModal({ isOpen, onClose, onConsent, consentHref }: DataConsentModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0f172a] border border-white/[0.1] rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-white">Health Data Access</h3>
              <p className="text-xs text-[var(--text-muted)]">Review before connecting</p>
            </div>
          </div>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            By connecting your health records via <strong className="text-white">1upHealth</strong>, you consent to CareCompanion importing the following data:
          </p>
        </div>

        {/* Data types */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              'Medications',
              'Lab results',
              'Conditions',
              'Allergies',
              'Appointments',
              'Doctors',
              'Claims',
              'Insurance',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-xs text-[#e2e8f0] py-1.5 px-3 rounded-lg bg-white/[0.06] border border-white/[0.06]">
                <span className="text-emerald-400">&#x2713;</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Promises */}
        <div className="px-6 pb-5">
          <div className="space-y-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-start gap-2">
              <span className="text-[#A78BFA] mt-0.5">&#x2022;</span>
              <span><strong className="text-[var(--text-secondary)]">Read-only access</strong> &mdash; we never modify your hospital records</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#A78BFA] mt-0.5">&#x2022;</span>
              <span><strong className="text-[var(--text-secondary)]">You can disconnect</strong> at any time from Settings</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#A78BFA] mt-0.5">&#x2022;</span>
              <span><strong className="text-[var(--text-secondary)]">We never sell</strong> your health data to third parties</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-[var(--text-muted)] hover:text-white py-2.5 px-4 rounded-xl border border-white/[0.08] hover:border-white/[0.15] transition-all"
          >
            Cancel
          </button>
          {consentHref ? (
            <a
              href={consentHref}
              onClick={onConsent}
              className="flex-1 gradient-btn text-white font-semibold text-sm py-2.5 px-4 rounded-xl text-center"
            >
              I Agree &mdash; Connect
            </a>
          ) : (
            <button
              onClick={onConsent}
              className="flex-1 gradient-btn text-white font-semibold text-sm py-2.5 px-4 rounded-xl"
            >
              I Agree &mdash; Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
