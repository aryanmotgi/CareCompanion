'use client';

import { useState } from 'react';

export interface PickerProfile {
  id: string;
  patientName: string | null;
  cancerType: string | null;
  relationship: string | null;
  onboardingCompleted: boolean | null;
}

interface OnboardingProfilePickerProps {
  profiles: PickerProfile[];
  onSelect: (profileId: string | null) => void;
}

// Deterministic gradient per profile index (cycles through 4 options)
const AVATAR_GRADIENTS = [
  'from-[#6366F1] to-[#A78BFA]',
  'from-[#EC4899] to-[#F97316]',
  'from-[#14B8A6] to-[#6366F1]',
  'from-[#F59E0B] to-[#EC4899]',
];

function getInitials(name: string | null, relationship: string | null): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (relationship === 'self') return 'ME';
  return '??';
}

function getDisplayName(profile: PickerProfile): string {
  if (profile.relationship === 'self') return 'You';
  return profile.patientName || 'Unknown';
}

export function OnboardingProfilePicker({ profiles, onSelect }: OnboardingProfilePickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div
      className="space-y-6"
      style={{ animation: 'slideInLeft 0.35s ease-out' }}
    >
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(28px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Heading */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#A78BFA] shadow-lg shadow-[#6366F1]/30 mx-auto mb-4">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-bold text-white">
          Who are you managing care for?
        </h1>
        <p className="mt-2 text-[var(--text-secondary)] text-sm">
          Continue with an existing profile or add someone new.
        </p>
      </div>

      {/* Existing profile cards */}
      <div className="space-y-3">
        {profiles.map((profile, idx) => {
          const initials = getInitials(profile.patientName, profile.relationship);
          const displayName = getDisplayName(profile);
          const gradient = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
          const isHovered = hovered === profile.id;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              onMouseEnter={() => setHovered(profile.id)}
              onMouseLeave={() => setHovered(null)}
              className={`w-full text-left rounded-2xl p-4 border transition-all duration-200 flex items-center gap-4 ${
                isHovered
                  ? 'border-[#A78BFA]/50 bg-[#A78BFA]/10'
                  : 'border-[var(--border)] bg-[var(--bg-card)] hover:border-white/20'
              }`}
              aria-label={`Continue with ${displayName}`}
            >
              {/* Avatar */}
              <div
                className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${gradient} text-white font-bold text-sm select-none`}
                aria-hidden="true"
              >
                {initials}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{displayName}</p>
                {profile.cancerType ? (
                  <p className="text-sm text-[var(--text-muted)] truncate">{profile.cancerType} cancer</p>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No diagnosis set</p>
                )}
              </div>

              {/* Chevron */}
              <svg
                className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${isHovered ? 'text-[#A78BFA]' : 'text-[var(--text-muted)]'}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          );
        })}

        {/* Add another person card */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          onMouseEnter={() => setHovered('__new__')}
          onMouseLeave={() => setHovered(null)}
          className={`w-full text-left rounded-2xl p-4 border border-dashed transition-all duration-200 flex items-center gap-4 ${
            hovered === '__new__'
              ? 'border-[#6366F1]/60 bg-[#6366F1]/10'
              : 'border-[var(--border)] bg-transparent hover:border-white/20'
          }`}
          aria-label="Add a new care profile"
        >
          {/* Plus icon */}
          <div
            className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center bg-white/5"
            aria-hidden="true"
          >
            <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">Add another person</p>
            <p className="text-sm text-[var(--text-muted)]">Create a new care profile</p>
          </div>

          <svg
            className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${hovered === '__new__' ? 'text-[#6366F1]' : 'text-[var(--text-muted)]'}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
