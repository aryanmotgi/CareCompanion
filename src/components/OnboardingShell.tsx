'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { OnboardingProfilePicker, PickerProfile } from './OnboardingProfilePicker';

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
}

export function OnboardingShell({
  allProfiles,
  userName,
  userEmail,
  userAvatar,
}: OnboardingShellProps) {
  // undefined = not yet chosen; null = create new; string = edit existing
  const [selectedProfileId, setSelectedProfileId] = useState<
    string | null | undefined
  >(allProfiles.length === 1 ? allProfiles[0].id : undefined);

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

  // Map camelCase DB shape → snake_case ExistingProfile for OnboardingWizard
  const existingProfileForWizard = activeProfile
    ? {
        id: activeProfile.id,
        cancer_type: activeProfile.cancerType,
        cancer_stage: activeProfile.cancerStage,
        treatment_phase: activeProfile.treatmentPhase,
        relationship: activeProfile.relationship,
        patient_name: activeProfile.patientName,
        patient_age: activeProfile.patientAge,
        onboarding_priorities: activeProfile.onboardingPriorities,
      }
    : null;

  // Picker profiles (only need a subset of fields)
  const pickerProfiles: PickerProfile[] = allProfiles.map((p) => ({
    id: p.id,
    patientName: p.patientName,
    cancerType: p.cancerType,
    relationship: p.relationship,
    onboardingCompleted: p.onboardingCompleted,
  }));

  if (shouldShowPicker) {
    return (
      <OnboardingProfilePicker
        profiles={pickerProfiles}
        onSelect={setSelectedProfileId}
      />
    );
  }

  return (
    <OnboardingWizard
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      existingProfileId={activeProfileId}
      existingProfile={existingProfileForWizard}
    />
  );
}
