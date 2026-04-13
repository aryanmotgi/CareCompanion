'use client';

import Link from 'next/link';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      {/* Fully opaque backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-lg" onClick={onClose} />

      {/* Modal — solid dark background, no transparency */}
      <div className="relative w-full max-w-md rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
        {/* Close X button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[#94a3b8] hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)' }}>
              <svg className="w-5 h-5 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <div>
              <h3 id="consent-title" className="text-lg font-bold text-white">Health Data Access</h3>
              <p className="text-xs text-[#64748b]">Review before connecting</p>
            </div>
          </div>
          <p className="text-sm text-[#94a3b8] leading-relaxed">
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
              <div key={item} className="flex items-center gap-2 text-xs text-[#e2e8f0] py-2 px-3 rounded-lg border" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-emerald-400">&#x2713;</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Promises */}
        <div className="px-6 pb-4">
          <div className="space-y-2 text-xs text-[#64748b]">
            <div className="flex items-start gap-2">
              <span className="text-[#A78BFA] mt-0.5">&#x2022;</span>
              <span><strong className="text-[#94a3b8]">Read-only access</strong> &mdash; we never modify your hospital records</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#A78BFA] mt-0.5">&#x2022;</span>
              <span><strong className="text-[#94a3b8]">Disconnect anytime</strong> &mdash; removes access and stops all future syncs</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[#A78BFA] mt-0.5">&#x2022;</span>
              <span><strong className="text-[#94a3b8]">Never sold</strong> &mdash; your health data is never shared with advertisers or third parties</span>
            </div>
          </div>
        </div>

        {/* Privacy policy link */}
        <div className="px-6 pb-5">
          <p className="text-[11px] text-[#475569]">
            By connecting, you agree to our{' '}
            <Link href="/privacy" target="_blank" className="text-[#A78BFA] hover:text-[#c4b5fd] underline underline-offset-2 transition-colors">
              Privacy Policy
            </Link>
            {' '}and{' '}
            <Link href="/terms" target="_blank" className="text-[#A78BFA] hover:text-[#c4b5fd] underline underline-offset-2 transition-colors">
              Terms of Service
            </Link>
            . Connection is powered by{' '}
            <strong className="text-[#64748b]">1upHealth</strong>.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-[#94a3b8] hover:text-white py-2.5 px-4 rounded-xl transition-all"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
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
