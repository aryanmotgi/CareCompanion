export interface CareProfile {
  id: string;
  userId: string;
  patientName: string | null;
  patientAge: number | null;
  relationship: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  cancerType?: string | null;
  cancerStage?: string | null;
  treatmentPhase?: string | null;
  conditions?: string | null;
  allergies?: string | null;
  onboardingPriorities?: string[] | null;
  onboardingCompleted?: boolean | null;
  createdAt: Date | null;
}

export interface Medication {
  id: string;
  careProfileId: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  prescribingDoctor: string | null;
  refillDate: string | null;
  pharmacyPhone?: string | null;
  notes: string | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface Doctor {
  id: string;
  careProfileId: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  notes: string | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface Appointment {
  id: string;
  careProfileId: string;
  doctorName: string | null;
  specialty: string | null;
  dateTime: Date | null;
  location: string | null;
  purpose: string | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface Document {
  id: string;
  careProfileId: string;
  type: string | null;
  documentType?: string | null;
  description: string | null;
  summary?: string | null;
  documentDate: string | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface Message {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date | null;
}

export interface ConnectedApp {
  id: string;
  userId: string;
  source: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: Date | null;
  lastSynced: Date | null;
  metadata: unknown;
  createdAt: Date | null;
}

export interface Insurance {
  id: string;
  userId: string;
  provider: string;
  memberId: string | null;
  groupNumber: string | null;
  deductibleLimit: string | null;
  deductibleUsed: string | null;
  oopLimit: string | null;
  oopUsed: string | null;
  planYear: number | null;
  createdAt: Date | null;
}

export interface Claim {
  id: string;
  userId: string;
  serviceDate: string | null;
  providerName: string | null;
  billedAmount: string | null;
  paidAmount: string | null;
  patientResponsibility: string | null;
  status: string | null;
  denialReason: string | null;
  eobUrl: string | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface PriorAuth {
  id: string;
  userId: string;
  service: string;
  status: string | null;
  startDate: string | null;
  expiryDate: string | null;
  sessionsApproved: number | null;
  sessionsUsed: number | null;
  createdAt: Date | null;
}

export interface FsaHsa {
  id: string;
  userId: string;
  provider: string;
  accountType: string | null;
  balance: string | null;
  contributionLimit: string | null;
  planYear: number | null;
  lastSynced: Date | null;
  createdAt: Date | null;
}

export interface LabResult {
  id: string;
  userId: string;
  testName: string;
  value: string | null;
  unit: string | null;
  referenceRange: string | null;
  isAbnormal: boolean | null;
  dateTaken: string | null;
  source: string | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  isRead: boolean | null;
  deletedAt?: Date | null;
  createdAt: Date | null;
}

export interface Memory {
  id: string;
  userId: string;
  careProfileId: string | null;
  category: string;
  fact: string;
  source: string;
  confidence: string;
  createdAt: Date | null;
  lastReferenced: Date | null;
}

export interface ConversationSummary {
  id: string;
  userId: string;
  summary: string;
  topics: string[] | null;
  messageCount: number | null;
  createdAt: Date | null;
}

// Form types for setup wizard
export interface MedicationForm {
  name: string;
  dose: string;
  frequency: string;
  prescribing_doctor: string;
  refill_date: string;
}

export interface DoctorForm {
  name: string;
  specialty: string;
  phone: string;
}

export interface AppointmentForm {
  doctor_name: string;
  date_time: string;
  purpose: string;
}

export interface SetupFormData {
  patient_name: string;
  patient_age: string;
  relationship: string;
  conditions: string;
  allergies: string;
  medications: MedicationForm[];
  doctors: DoctorForm[];
  appointments: AppointmentForm[];
}

export interface NotificationCategoryPrefs {
  medications?: { enabled: boolean; refill_reminders: boolean; dose_reminders: boolean; interaction_alerts: boolean }
  appointments?: { enabled: boolean; reminder_24hr: boolean; reminder_1hr: boolean; prep_reminder: boolean }
  lab_results?: { enabled: boolean; new_results: boolean; abnormal_alerts: boolean; trend_alerts: boolean }
  insurance?: { enabled: boolean; claim_status: boolean; prior_auth: boolean; appeal_deadlines: boolean }
  care_team?: { enabled: boolean; wellness_checkins: boolean; shared_records: boolean }
}

export interface UserSettings {
  id: string
  userId: string
  refillReminders: boolean | null
  appointmentReminders: boolean | null
  labAlerts: boolean | null
  claimUpdates: boolean | null
  aiPersonality: string | null
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
  emailNotifications?: boolean | null
  pushNotifications?: boolean | null
  createdAt: Date | null
  updatedAt: Date | null
}

export interface CareTeamMember {
  id: string;
  careProfileId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  joinedAt: Date | null;
  createdAt: Date | null;
  // Joined fields
  email?: string;
  displayName?: string;
}

export interface CareTeamInvite {
  id: string;
  careProfileId: string;
  invitedEmail: string;
  role: string;
  invitedBy: string;
  status: string;
  createdAt: Date | null;
  expiresAt: Date | null;
}

export interface CareTeamActivity {
  id: string;
  careProfileId: string;
  userId: string | null;
  userName: string | null;
  action: string;
  createdAt: Date | null;
}

export interface UserPreferences {
  id: string;
  userId: string;
  activeProfileId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface MedicationReminder {
  id: string;
  userId: string;
  medicationId: string;
  medicationName: string;
  dose: string | null;
  reminderTimes: string[];
  daysOfWeek: string[];
  isActive: boolean | null;
  createdAt: Date | null;
}

export interface ReminderLog {
  id: string;
  userId: string;
  reminderId: string;
  medicationName: string;
  scheduledTime: Date;
  status: string;
  respondedAt: Date | null;
  createdAt: Date | null;
}

export interface SymptomEntry {
  id: string;
  userId: string;
  careProfileId: string | null;
  date: string;
  painLevel: number | null;
  mood: string | null;
  sleepQuality: string | null;
  sleepHours: string | null;
  appetite: string | null;
  energy: string | null;
  symptoms: string[] | null;
  notes: string | null;
  createdAt: Date | null;
}
