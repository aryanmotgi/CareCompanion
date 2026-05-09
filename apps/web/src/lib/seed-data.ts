/**
 * Synthetic test data constants for QA and staging environments.
 * All data is obviously fabricated — safe for HIPAA compliance.
 * Real patient data is never used here.
 */

export const SEED_CARE_PROFILE = {
  patientName: 'Alex Test-Patient',
  patientAge: 52,
  relationship: 'self',
  cancerType: 'Colorectal Cancer (TEST)',
  cancerStage: 'Stage II',
  treatmentPhase: 'active_treatment',
  conditions: 'Stage II Colorectal Cancer (TEST DATA)\nHypertension (TEST DATA)',
  allergies: 'Penicillin (TEST DATA)',
  onboardingCompleted: true,
  emergencyContactName: 'Test Emergency Contact',
  emergencyContactPhone: '555-0100',
}

export const SEED_MEDICATIONS = [
  {
    name: 'Capecitabine (TEST)',
    dose: '1250mg/m²',
    frequency: 'Twice daily, days 1-14 of cycle',
    prescribingDoctor: 'Dr. Test Oncologist',
    refillDate: '2026-05-15',
    notes: 'QA seed data — not real',
  },
  {
    name: 'Bevacizumab (TEST)',
    dose: '5mg/kg',
    frequency: 'IV every 2 weeks',
    prescribingDoctor: 'Dr. Test Oncologist',
    refillDate: '2026-05-20',
    notes: 'QA seed data — not real',
  },
  {
    name: 'Ondansetron (TEST)',
    dose: '8mg',
    frequency: 'As needed for nausea',
    prescribingDoctor: 'Dr. Test Primary Care',
    refillDate: '2026-05-10',
    notes: 'QA seed data — not real',
  },
]

export const SEED_LAB_RESULTS = [
  {
    testName: 'CEA (Carcinoembryonic Antigen) (TEST)',
    value: '8.2',
    unit: 'ng/mL',
    referenceRange: '<3.0',
    isAbnormal: true,
    dateTaken: '2026-04-20',
    source: 'QA seed data',
  },
  {
    testName: 'Hemoglobin (TEST)',
    value: '11.8',
    unit: 'g/dL',
    referenceRange: '12.0-16.0',
    isAbnormal: true,
    dateTaken: '2026-04-20',
    source: 'QA seed data',
  },
  {
    testName: 'Creatinine (TEST)',
    value: '0.9',
    unit: 'mg/dL',
    referenceRange: '0.6-1.2',
    isAbnormal: false,
    dateTaken: '2026-04-20',
    source: 'QA seed data',
  },
]

export const SEED_APPOINTMENTS = [
  {
    doctorName: 'Dr. Test Oncologist',
    specialty: 'Medical Oncology',
    dateTime: new Date('2026-05-05T10:00:00Z'),
    location: 'Test Cancer Center Clinic 1',
    purpose: 'Oncology follow-up (TEST DATA)',
  },
  {
    doctorName: 'Test Lab Services',
    specialty: 'Laboratory',
    dateTime: new Date('2026-05-12T08:00:00Z'),
    location: 'Test Cancer Center Lab',
    purpose: 'Pre-chemo bloodwork (TEST DATA)',
  },
]

export const SEED_DOCTORS = [
  {
    name: 'Dr. Test Oncologist',
    specialty: 'Medical Oncologist',
    phone: '555-0201',
    notes: 'QA seed data — not real',
  },
  {
    name: 'Dr. Test Primary Care',
    specialty: 'Primary Care',
    phone: '555-0202',
    notes: 'QA seed data — not real',
  },
]

export const SEED_NOTIFICATIONS = [
  {
    type: 'lab_result',
    title: 'Abnormal CEA Level (TEST)',
    message: 'CEA is 8.2 ng/mL (normal: <3.0). This is TEST DATA only.',
    isRead: false,
  },
  {
    type: 'refill',
    title: 'Ondansetron refill due soon (TEST)',
    message: 'Refill due in 10 days. This is TEST DATA only.',
    isRead: false,
  },
  {
    type: 'appointment',
    title: 'Oncology appointment in 12 days (TEST)',
    message: 'Dr. Test Oncologist at Test Cancer Center. This is TEST DATA only.',
    isRead: false,
  },
]

export const SEED_USER_SETTINGS = {
  refillReminders: true,
  appointmentReminders: true,
  labAlerts: true,
  claimUpdates: true,
  aiPersonality: 'professional' as const,
}
