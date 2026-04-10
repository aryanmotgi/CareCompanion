'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import type { CareProfile } from '@/lib/types';

interface ProfileSwitcherProps {
  profiles: CareProfile[];
  activeProfileId: string | null;
}

export function ProfileSwitcher({ profiles, activeProfileId }: ProfileSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { showToast } = useToast();

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Don't show switcher if only one profile
  if (profiles.length <= 1) return null;

  async function switchProfile(profileId: string) {
    if (profileId === activeProfileId) {
      setIsOpen(false);
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/api/profile-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile_id: profileId }),
      });
      if (!res.ok) throw new Error('Switch failed');
      showToast('Profile switched', 'success');
    } catch {
      showToast('Failed to switch profile', 'error');
    }
    setIsOpen(false);
    setSwitching(false);
    router.refresh();
  }

  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const COLORS = [
    'from-[#6366F1] to-[#A78BFA]',
    'from-pink-500 to-orange-400',
    'from-emerald-500 to-teal-400',
    'from-purple-500 to-pink-400',
    'from-amber-500 to-red-400',
  ];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
        disabled={switching}
      >
        <span className="text-[#f1f5f9] text-sm font-medium truncate max-w-[120px]">
          {activeProfile?.patient_name || 'Select patient'}
        </span>
        <svg className={`w-3.5 h-3.5 text-[#64748b] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-[#1e293b] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden z-50 animate-card-in">
          <div className="px-3 py-2 border-b border-white/[0.06]">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Switch Patient</p>
          </div>
          {profiles.map((p, i) => (
            <button
              key={p.id}
              onClick={() => switchProfile(p.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors ${p.id === activeProfileId ? 'bg-blue-500/10' : ''}`}
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {initials(p.patient_name || '??')}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-white font-medium truncate">{p.patient_name || 'Unknown'}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{p.relationship || ''}{p.patient_age ? ` · Age ${p.patient_age}` : ''}</p>
              </div>
              {p.id === activeProfileId && (
                <svg className="w-4 h-4 text-[#A78BFA] flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
          <a
            href="/setup"
            className="flex items-center gap-3 px-3 py-2.5 border-t border-white/[0.06] hover:bg-white/[0.04] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center text-[var(--text-muted)]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <span className="text-sm text-[var(--text-secondary)]">Add another patient</span>
          </a>
        </div>
      )}
    </div>
  );
}
