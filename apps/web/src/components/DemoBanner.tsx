'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export function DemoBanner() {
  const [leaving, setLeaving] = useState(false);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await signOut({ callbackUrl: '/' });
    } catch {
      window.location.href = '/';
    }
  };

  return (
    <div
      className="relative z-40 border-b border-amber-500/25 px-4 py-2.5"
      style={{
        background:
          'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 146, 60, 0.08) 50%, rgba(245, 158, 11, 0.12) 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/25 border border-amber-500/40 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-amber-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
            <span className="font-semibold text-amber-300 flex-shrink-0">Demo Mode</span>
            <span className="text-amber-400/40 hidden sm:inline">·</span>
            <span className="text-amber-200/70 hidden sm:inline truncate">
              You&apos;re exploring CareCompanion with sample data. Nothing is saved.
            </span>
            <span className="text-amber-200/70 sm:hidden truncate">Sample data only</span>
          </div>
        </div>
        <button
          onClick={handleLeave}
          disabled={leaving}
          className="flex-shrink-0 text-xs font-semibold text-white/90 hover:text-white bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.12] hover:border-white/[0.2] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
        >
          {leaving ? 'Leaving...' : 'Leave Demo'}
        </button>
      </div>
    </div>
  );
}
