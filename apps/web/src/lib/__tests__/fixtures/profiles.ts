import type { CareProfile } from '@/lib/types';

export const mockProfile: Partial<CareProfile> = {
  id: 'profile-test-1',
  userId: 'user-test-1',
  patientName: 'Eleanor',
  cancerType: 'Breast Cancer (HER2+)',
  cancerStage: 'Stage 2',
  treatmentPhase: 'active_treatment',
  conditions: 'Hypertension',
  allergies: 'Penicillin',
  relationship: 'mother',
  role: 'caregiver',
  caregiverForName: 'Eleanor',
  caregiverRelationship: 'parent',
  onboardingCompleted: true,
  onboardingPriorities: ['medications', 'lab_results'],
  dateOfBirth: null,
};

export const mockProfileWithDOB: Partial<CareProfile> = {
  ...mockProfile,
  dateOfBirth: '1958-04-12',
};
