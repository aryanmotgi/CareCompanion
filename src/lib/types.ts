export interface CareProfile {
  id: string;
  user_id: string;
  patient_name: string | null;
  patient_age: number | null;
  relationship: string | null;
  conditions: string | null;
  allergies: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  created_at: string;
}

export interface Medication {
  id: string;
  care_profile_id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  prescribing_doctor: string | null;
  start_date: string | null;
  refill_date: string | null;
  quantity_remaining: number | null;
  pharmacy_phone?: string | null;
  notes: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  care_profile_id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  care_profile_id: string;
  doctor_name: string | null;
  specialty: string | null;
  date_time: string | null;
  location: string | null;
  purpose: string | null;
  prep_notes: string | null;
  follow_up_notes: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  care_profile_id: string;
  type: string | null;
  file_url: string | null;
  description: string | null;
  document_date: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// Connected Apps
export interface ConnectedApp {
  id: string;
  user_id: string;
  source: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  last_synced: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Insurance
export interface Insurance {
  id: string;
  user_id: string;
  provider: string;
  member_id: string | null;
  group_number: string | null;
  deductible_limit: number | null;
  deductible_used: number;
  oop_limit: number | null;
  oop_used: number;
  plan_year: number | null;
  created_at: string;
}

// Claims
export interface Claim {
  id: string;
  user_id: string;
  service_date: string | null;
  provider_name: string | null;
  billed_amount: number | null;
  paid_amount: number | null;
  patient_responsibility: number | null;
  status: 'paid' | 'denied' | 'pending';
  denial_reason: string | null;
  eob_url: string | null;
  created_at: string;
}

// Prior Authorizations
export interface PriorAuth {
  id: string;
  user_id: string;
  service: string;
  status: string | null;
  start_date: string | null;
  expiry_date: string | null;
  sessions_approved: number | null;
  sessions_used: number;
  created_at: string;
}

// FSA / HSA
export interface FsaHsa {
  id: string;
  user_id: string;
  provider: string;
  account_type: 'fsa' | 'hsa';
  balance: number;
  contribution_limit: number | null;
  plan_year: number | null;
  last_synced: string | null;
  created_at: string;
}

// Lab Results
export interface LabResult {
  id: string;
  user_id: string;
  test_name: string;
  value: string | null;
  unit: string | null;
  reference_range: string | null;
  is_abnormal: boolean;
  date_taken: string | null;
  source: string | null;
  created_at: string;
}

// Notifications
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

// Long-Term Memory
export interface Memory {
  id: string;
  user_id: string;
  care_profile_id: string | null;
  category: 'medication' | 'condition' | 'allergy' | 'insurance' | 'financial' | 'appointment' | 'preference' | 'family' | 'provider' | 'lab_result' | 'lifestyle' | 'legal' | 'other';
  fact: string;
  source: 'conversation' | 'photo_scan' | 'fhir_sync' | 'manual';
  confidence: 'high' | 'medium' | 'low';
  created_at: string;
  last_referenced: string;
}

export interface ConversationSummary {
  id: string;
  user_id: string;
  summary: string;
  topics: string[];
  message_count: number;
  created_at: string;
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

export interface UserSettings {
  id: string
  user_id: string
  refill_reminders: boolean
  appointment_reminders: boolean
  lab_alerts: boolean
  claim_updates: boolean
  ai_personality: 'professional' | 'friendly' | 'concise'
  created_at: string
  updated_at: string
}

// Care Team
export interface CareTeamMember {
  id: string;
  care_profile_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  invited_by: string | null;
  joined_at: string;
  created_at: string;
  // Joined fields
  email?: string;
  display_name?: string;
}

export interface CareTeamInvite {
  id: string;
  care_profile_id: string;
  invited_email: string;
  role: 'editor' | 'viewer';
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  expires_at: string;
}

export interface CareTeamActivity {
  id: string;
  care_profile_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  created_at: string;
}

// User Preferences (multi-patient)
export interface UserPreferences {
  id: string;
  user_id: string;
  active_profile_id: string | null;
  created_at: string;
  updated_at: string;
}

// Medication Reminders
export interface MedicationReminder {
  id: string;
  user_id: string;
  medication_id: string;
  medication_name: string;
  dose: string | null;
  reminder_times: string[];
  days_of_week: string[];
  is_active: boolean;
  created_at: string;
}

export interface ReminderLog {
  id: string;
  user_id: string;
  reminder_id: string;
  medication_name: string;
  scheduled_time: string;
  status: 'pending' | 'taken' | 'snoozed' | 'missed';
  responded_at: string | null;
  created_at: string;
}

// Symptom Journal
export interface SymptomEntry {
  id: string;
  user_id: string;
  care_profile_id: string | null;
  date: string;
  pain_level: number | null;
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible' | null;
  sleep_quality: 'great' | 'good' | 'fair' | 'poor' | 'terrible' | null;
  sleep_hours: number | null;
  appetite: 'normal' | 'increased' | 'decreased' | 'none' | null;
  energy: 'high' | 'normal' | 'low' | 'very_low' | null;
  symptoms: string[];
  notes: string | null;
  created_at: string;
}
