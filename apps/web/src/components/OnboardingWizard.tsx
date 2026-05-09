'use client'

import { CaregiverWizard } from './CaregiverWizard'
import { PatientWizard } from './PatientWizard'

export function OnboardingWizard({
  careProfileId,
  userRole,
  careGroupId,
  onComplete,
}: {
  careProfileId: string
  userRole: 'caregiver' | 'patient' | 'self' | null
  careGroupId?: string
  onComplete: () => void
}) {
  if (userRole === 'caregiver') {
    return <CaregiverWizard careProfileId={careProfileId} careGroupId={careGroupId} onComplete={onComplete} />
  }
  return <PatientWizard careProfileId={careProfileId} onComplete={onComplete} />
}
