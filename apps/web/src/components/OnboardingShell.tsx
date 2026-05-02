'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { OnboardingProfilePicker, PickerProfile } from './OnboardingProfilePicker';
import { CareGroupScreen } from './CareGroupScreen';

const OnboardingWizard = dynamic(
  () => import('@/components/OnboardingWizard').then((m) => m.OnboardingWizard),
  { ssr: false }
);

// Shape returned from page.tsx DB select (camelCase Drizzle keys)
interface ShellProfile {
  id: string;
  patientName: string | null;
  patientAge: number | null;
  cancerType: string | null;
  cancerStage: string | null;
  treatmentPhase: string | null;
  relationship: string | null;
  onboardingCompleted: boolean | null;
  onboardingPriorities: string[] | null;
}

interface OnboardingShellProps {
  allProfiles: ShellProfile[];
  userName: string;
  userEmail: string;
  userAvatar: string;
  userRole?: 'caregiver' | 'patient' | 'self' | null;
}

type Phase = 'care-group' | 'wizard' | 'complete';

export function OnboardingShell({
  allProfiles,
  userName,
  userEmail,
  userRole: userRoleProp,
}: OnboardingShellProps) {
  // undefined = not yet chosen; null = create new; string = edit existing
  const [selectedProfileId, setSelectedProfileId] = useState<
    string | null | undefined
  >(allProfiles.length === 1 ? allProfiles[0].id : undefined);

  const [phase, setPhase] = useState<Phase>(
    allProfiles.some(p => p.onboardingCompleted === true) ? 'wizard' : 'care-group'
  );
  const [careGroupId, setCareGroupId] = useState<string | undefined>();
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);
  const [profileCreateError, setProfileCreateError] = useState(false);

  const completedProfiles = allProfiles.filter(
    (p) => p.onboardingCompleted === true
  );
  const hasCompleted = completedProfiles.length > 0;

  // If there are no completed profiles, skip picker and go straight to wizard
  // using the first incomplete profile (if any) or null for brand-new.
  const shouldShowPicker = hasCompleted && allProfiles.length > 1 && selectedProfileId === undefined;

  // Determine which profile to load into the wizard
  const activeProfile: ShellProfile | null = (() => {
    if (selectedProfileId === null) return null; // new profile
    if (selectedProfileId !== undefined) {
      return allProfiles.find((p) => p.id === selectedProfileId) ?? null;
    }
    // No picker shown — use first incomplete profile or null
    const firstIncomplete = allProfiles.find(
      (p) => !p.onboardingCompleted
    );
    return firstIncomplete ?? null;
  })();

  const activeProfileId = activeProfile?.id ?? null;

  // Derive userRole: prefer explicit prop, fall back to relationship on existing profile
  const derivedRole = ((): 'caregiver' | 'patient' | 'self' | null => {
    if (userRoleProp != null) return userRoleProp;
    const rel = activeProfile?.relationship;
    if (rel === 'self') return 'patient';
    if (rel && rel !== 'self') return 'caregiver';
    return null;
  })();

  // Normalize to CareGroupScreen-compatible type (no null)
  const careGroupRole: 'caregiver' | 'patient' | 'self' =
    derivedRole === 'caregiver' ? 'caregiver'
    : derivedRole === 'self' ? 'self'
    : 'patient';

  // Picker profiles (only need a subset of fields)
  const pickerProfiles: PickerProfile[] = allProfiles.map((p) => ({
    id: p.id,
    patientName: p.patientName,
    cancerType: p.cancerType,
    relationship: p.relationship,
    onboardingCompleted: p.onboardingCompleted,
  }));

  if (profileCreateError) {
    return (
      <div className="flex flex-col gap-4 p-6 max-w-md mx-auto text-center">
        <p className="text-sm text-red-400">Something went wrong setting up your profile. Please refresh the page and try again.</p>
        <button type="button" onClick={() => { setProfileCreateError(false); }} className="text-xs underline" style={{ color: 'rgba(255,255,255,0.4)' }}>Try again</button>
      </div>
    );
  }

  if (shouldShowPicker) {
    return (
      <OnboardingProfilePicker
        profiles={pickerProfiles}
        onSelect={setSelectedProfileId}
      />
    );
  }

  // Phase: care-group
  if (phase === 'care-group') {
    return (
      <CareGroupScreen
        userRole={careGroupRole}
        userDisplayName={userName || userEmail.split('@')[0] || 'You'}
        onComplete={async (cgId) => {
          setCareGroupId(cgId);
          // If this is a new user with no care profile, create one now
          if (!activeProfileId) {
            try {
              const res = await fetch('/api/care-profiles', { method: 'POST' });
              const data = await res.json() as { id?: string };
              if (data.id) {
                setCreatedProfileId(data.id);
              } else {
                setProfileCreateError(true);
                return;
              }
            } catch {
              setProfileCreateError(true);
              return;
            }
          }
          setPhase('wizard');
        }}
      />
    );
  }

  // Phase: wizard
  const wizardProfileId = activeProfileId ?? createdProfileId;

  if (phase === 'wizard' && wizardProfileId) {
    return (
      <OnboardingWizard
        careProfileId={wizardProfileId}
        userRole={derivedRole}
        careGroupId={careGroupId}
        onComplete={() => setPhase('complete')}
      />
    );
  }

  // Phase: complete — redirect to dashboard
  if (phase === 'complete' || (phase === 'wizard' && !activeProfileId && !createdProfileId)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
    return null;
  }

  return null;
}
