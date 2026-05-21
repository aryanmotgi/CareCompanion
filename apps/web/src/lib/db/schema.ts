import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * pgvector halfvec (0.7+) — half-precision float vector. Postgres returns
 * `[1,2,3]` string form; we parse to number[] on read and emit the same
 * literal form on write.
 */
export const halfvec = (dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `halfvec(${dimensions})`
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`
    },
    fromDriver(value: string): number[] {
      return JSON.parse(value)
    },
  })

/** tsvector — read-only from Drizzle (populated by trigger in migration 014). */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector'
  },
})

// ── Users (populated on sign-in via OAuth provider) ──────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  providerSub: text('cognito_sub').unique(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  isDemo: boolean('is_demo').default(false),
  hipaaConsent: boolean('hipaa_consent').default(false),
  hipaaConsentAt: timestamp('hipaa_consent_at', { withTimezone: true }),
  hipaaConsentVersion: text('hipaa_consent_version'),
  resetNonce: text('reset_nonce'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  role: text('role'),  // 'caregiver' | 'patient' | 'self' — null for pre-feature users
})

// ── User Identities (per-provider linkage) ───────────────────────────────────
// One row per (user, auth provider). Lets a single user link 'password' +
// 'apple' + 'google' without provider collisions on the legacy users.cognito_sub
// column.
export const userIdentities = pgTable('user_identities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),       // 'password' | 'apple' | 'google'
  providerSub: text('provider_sub'),          // null for password rows
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  providerSubUniq: uniqueIndex('user_identities_provider_sub_uniq').on(t.provider, t.providerSub),
  userProviderUniq: uniqueIndex('user_identities_user_provider_uniq').on(t.userId, t.provider),
  emailIdx: index('user_identities_email_idx').on(t.email),
}))

// ── Care Profiles ─────────────────────────────────────────────────────────────
export const careProfiles = pgTable('care_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientName: text('patient_name'),
  patientAge: integer('patient_age'),
  relationship: text('relationship'),
  cancerType: text('cancer_type'),
  cancerStage: text('cancer_stage'),
  treatmentPhase: text('treatment_phase'),
  conditions: text('conditions'),
  allergies: text('allergies'),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingPriorities: text('onboarding_priorities').array().default(sql`'{}'`),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  role: text('role').notNull().default('patient'),
  caregiverForName: text('caregiver_for_name'),
  checkinStreak: integer('checkin_streak').notNull().default(0),
  lastRadarRunAt: timestamp('last_radar_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  caregivingExperience: text('caregiving_experience'), // 'first_time' | 'some_experience' | 'experienced'
  primaryConcern: text('primary_concern'),             // 'medications' | 'lab_results' | 'coordinating_care' | 'emotional_support'
  moodCheckIn: text('mood_check_in'),                  // 'okay' | 'anxious' | 'overwhelmed' | 'proactive' — self-care wizard step 1
  supportStyle: text('support_style'),                 // 'informed' | 'check_in' | 'appointments' | 'available' — self-care wizard step 4
  city:    text('city'),
  state:   text('state'),
  zipCode: text('zip_code'),
  // ── Tier-1 onboarding additions (migration 010) ─────────────────────────
  dateOfBirth:     date('date_of_birth'),               // PHI — never log
  sexAtBirth:      text('sex_at_birth'),                // 'female' | 'male' | 'intersex' | 'prefer_not'
  biomarkers:      jsonb('biomarkers'),                 // cancer-type-specific keys: HER2, ER, PR, EGFR, ALK, PD-L1, KRAS, …
  diagnosisDate:   date('diagnosis_date'),
  ecogStatus:      integer('ecog_status'),              // 0..4
  priorTreatments: text('prior_treatments'),
  fieldOverrides: jsonb('field_overrides'),            // { cancerType: true, stage: true, ... } — FHIR sync skips true fields
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Conversations ─────────────────────────────────────────────────────────────
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  tags: text('tags').array().default(sql`'{}'`),
  lastMessagePreview: text('last_message_preview'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Messages ──────────────────────────────────────────────────────────────────
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  userCreatedIdx: index('messages_user_created_idx').on(t.userId, t.createdAt),
}))

// ── Medications ───────────────────────────────────────────────────────────────
export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dose: text('dose'),
  frequency: text('frequency'),
  prescribingDoctor: text('prescribing_doctor'),
  refillDate: date('refill_date'),
  notes: text('notes'),
  pharmacyPhone: text('pharmacy_phone'),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Doctors ───────────────────────────────────────────────────────────────────
export const doctors = pgTable('doctors', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  specialty: text('specialty'),
  phone: text('phone'),
  notes: text('notes'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Appointments ──────────────────────────────────────────────────────────────
export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  doctorName: text('doctor_name'),
  specialty: text('specialty'),
  dateTime: timestamp('date_time', { withTimezone: true }),
  location: text('location'),
  purpose: text('purpose'),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Clinical History (HealthKit FHIR ingestion) ───────────────────────────────
// Mirrors medications/appointments pattern: care_profile_id + healthkit_fhir_id UNIQUE
// for idempotent upsert from /api/healthkit/sync.
export const conditions = pgTable('conditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  code: text('code'),
  display: text('display').notNull(),
  clinicalStatus: text('clinical_status'),
  onsetDateTime: timestamp('onset_date_time', { withTimezone: true }),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const allergies = pgTable('allergies', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  code: text('code'),
  display: text('display').notNull(),
  reaction: text('reaction'),
  criticality: text('criticality'),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const procedures = pgTable('procedures', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  code: text('code'),
  display: text('display').notNull(),
  performedDateTime: timestamp('performed_date_time', { withTimezone: true }),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const immunizations = pgTable('immunizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  code: text('code'),
  display: text('display').notNull(),
  occurrenceDateTime: timestamp('occurrence_date_time', { withTimezone: true }),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Documents ─────────────────────────────────────────────────────────────────
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  type: text('type'),
  documentType: text('document_type'),
  description: text('description'),
  summary: text('summary'),
  documentDate: date('document_date'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Connected Apps ────────────────────────────────────────────────────────────
export const connectedApps = pgTable('connected_apps', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastSynced: timestamp('last_synced', { withTimezone: true }),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Insurance ─────────────────────────────────────────────────────────────────
export const insurance = pgTable('insurance', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  memberId: text('member_id'),
  groupNumber: text('group_number'),
  deductibleLimit: numeric('deductible_limit'),
  deductibleUsed: numeric('deductible_used').default('0'),
  oopLimit: numeric('oop_limit'),
  oopUsed: numeric('oop_used').default('0'),
  planYear: integer('plan_year'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Claims ────────────────────────────────────────────────────────────────────
export const claims = pgTable('claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceDate: date('service_date'),
  providerName: text('provider_name'),
  billedAmount: numeric('billed_amount'),
  paidAmount: numeric('paid_amount'),
  patientResponsibility: numeric('patient_responsibility'),
  status: text('status'),
  denialReason: text('denial_reason'),
  eobUrl: text('eob_url'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('claims_user_id_idx').on(table.userId),
}))

// ── Prior Authorizations ──────────────────────────────────────────────────────
export const priorAuths = pgTable('prior_auths', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  service: text('service').notNull(),
  status: text('status'),
  startDate: date('start_date'),
  expiryDate: date('expiry_date'),
  sessionsApproved: integer('sessions_approved'),
  sessionsUsed: integer('sessions_used').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── FSA/HSA ───────────────────────────────────────────────────────────────────
export const fsaHsa = pgTable('fsa_hsa', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  accountType: text('account_type'),
  balance: numeric('balance').default('0'),
  contributionLimit: numeric('contribution_limit'),
  planYear: integer('plan_year'),
  lastSynced: timestamp('last_synced', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Lab Results ───────────────────────────────────────────────────────────────
export const labResults = pgTable('lab_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  testName: text('test_name').notNull(),
  value: text('value'),
  unit: text('unit'),
  referenceRange: text('reference_range'),
  isAbnormal: boolean('is_abnormal').default(false),
  directionIsGood: boolean('direction_is_good'),
  dateTaken: date('date_taken'),
  source: text('source'),
  healthkitFhirId: text('healthkit_fhir_id').unique(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message'),
  isRead: boolean('is_read').default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Memories ──────────────────────────────────────────────────────────────────
export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').references(() => careProfiles.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  fact: text('fact').notNull(),
  source: text('source').notNull().default('conversation'),
  confidence: text('confidence').notNull().default('high'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastReferenced: timestamp('last_referenced', { withTimezone: true }).defaultNow(),
  // ── Memory-v2 (migration 014) ──────────────────────────────────────────
  embedding: halfvec(768)('embedding'),
  factTsv: tsvector('fact_tsv'),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow(),
  validTo:   timestamp('valid_to',   { withTimezone: true }),
  polarity:  text('polarity').notNull().default('asserted'),
  status:    text('status').notNull().default('active'),
  subject:   text('subject').notNull().default('patient'),
  importance: numeric('importance', { precision: 2, scale: 1 }).notNull().default('0.5'),
  seenCount: integer('seen_count').notNull().default(1),
  tier:      integer('tier').notNull().default(3),
  trust:     numeric('trust', { precision: 2, scale: 1 }).notNull().default('0.5'),
  decayAt:   timestamp('decay_at', { withTimezone: true }),
  cycleNumber: integer('cycle_number'),
  labValueNumeric: numeric('lab_value_numeric'),
  labValueUnit: text('lab_value_unit'),
  measuredAt: timestamp('measured_at', { withTimezone: true }),
  severity: integer('severity'),
  slug: text('slug'),
})

// ── Conversation Summaries ────────────────────────────────────────────────────
export const conversationSummaries = pgTable('conversation_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  topics: text('topics').array().default(sql`'{}'`),
  messageCount: integer('message_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  embedding: halfvec(768)('embedding'),
})

// ── Memory access log (HIPAA audit, migration 014) ────────────────────────────
export const memoryAccessLog = pgTable('memory_access_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memoryIds: uuid('memory_ids').array().notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Daily token usage (budget caps, migration 014) ────────────────────────────
export const userUsage = pgTable('user_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  usageDate: date('usage_date').notNull().default(sql`CURRENT_DATE`),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cacheReadTokens: integer('cache_read_tokens').notNull().default(0),
  cacheCreateTokens: integer('cache_create_tokens').notNull().default(0),
  reservedInputTokens: integer('reserved_input_tokens').notNull().default(0),
  modelCalls: integer('model_calls').notNull().default(0),
})

// ── User Preferences ──────────────────────────────────────────────────────────
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  activeProfileId: uuid('active_profile_id'),
  oneupUserId: text('oneup_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── User Settings ─────────────────────────────────────────────────────────────
export const userSettings = pgTable('user_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  refillReminders: boolean('refill_reminders').default(true),
  appointmentReminders: boolean('appointment_reminders').default(true),
  labAlerts: boolean('lab_alerts').default(true),
  claimUpdates: boolean('claim_updates').default(true),
  aiPersonality: text('ai_personality').default('professional'),
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false),
  quietHoursStart: text('quiet_hours_start'),
  quietHoursEnd: text('quiet_hours_end'),
  timezone: text('timezone').default('America/New_York'),
  emailNotifications: boolean('email_notifications').default(false),
  pushNotifications: boolean('push_notifications').default(true),
  notificationPreferences: jsonb('notification_preferences').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Care Team Members ─────────────────────────────────────────────────────────
export const careTeamMembers = pgTable('care_team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('viewer'),
  invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
  gratitudeNudgeCount: integer('gratitude_nudge_count').notNull().default(0),
  lastGratitudeNudgeAt: timestamp('last_gratitude_nudge_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  profileIdx: index('care_team_members_profile_idx').on(t.careProfileId),
}))

// ── Care Team Invites ─────────────────────────────────────────────────────────
export const careTeamInvites = pgTable('care_team_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  invitedEmail: text('invited_email').notNull(),
  role: text('role').notNull().default('viewer'),
  invitedBy: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(
    sql`now() + interval '7 days'`
  ),
})

// ── Care Team Activity ────────────────────────────────────────────────────────
export const careTeamActivity = pgTable('care_team_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  userName: text('user_name'),
  action: text('action').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Medication Reminders ──────────────────────────────────────────────────────
export const medicationReminders = pgTable('medication_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  medicationId: uuid('medication_id').notNull().references(() => medications.id, { onDelete: 'cascade' }),
  medicationName: text('medication_name').notNull(),
  dose: text('dose'),
  reminderTimes: text('reminder_times').array().notNull().default(sql`'{}'`),
  daysOfWeek: text('days_of_week').array().notNull().default(
    sql`'{"mon","tue","wed","thu","fri","sat","sun"}'`
  ),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Reminder Logs ─────────────────────────────────────────────────────────────
export const reminderLogs = pgTable('reminder_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reminderId: uuid('reminder_id').notNull().references(() => medicationReminders.id, { onDelete: 'cascade' }),
  medicationName: text('medication_name').notNull(),
  scheduledTime: timestamp('scheduled_time', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('pending'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  userTimeIdx: index('reminder_logs_user_time_idx').on(t.userId, t.scheduledTime),
}))

// ── Symptom Entries ───────────────────────────────────────────────────────────
export const symptomEntries = pgTable('symptom_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').references(() => careProfiles.id, { onDelete: 'cascade' }),
  date: date('date').notNull().default(sql`current_date`),
  painLevel: integer('pain_level'),
  mood: text('mood'),
  sleepQuality: text('sleep_quality'),
  sleepHours: numeric('sleep_hours'),
  appetite: text('appetite'),
  energy: text('energy'),
  symptoms: text('symptoms').array().default(sql`'{}'`),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  userDateIdx: index('symptom_entries_user_date_idx').on(t.userId, t.date),
}))

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  ipAddress: text('ip_address'),
  method: text('method').notNull(),
  path: text('path').notNull(),
  statusCode: integer('status_code').notNull(),
  durationMs: integer('duration_ms').notNull().default(0),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  userCreatedIdx: index('audit_logs_user_created_idx').on(t.userId, t.createdAt),
}))

// ── Shared Links ──────────────────────────────────────────────────────────────
export const sharedLinks = pgTable('shared_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').references(() => careProfiles.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  type: text('type').notNull().default('health_summary'),
  title: text('title'),
  data: jsonb('data').notNull().default({}),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  viewCount: integer('view_count').notNull().default(0),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userTypExpiryIdx: index('shared_links_user_type_expiry_idx').on(table.userId, table.type, table.expiresAt, table.revokedAt),
}))

// ── Scanned Documents ─────────────────────────────────────────────────────────
export const scannedDocuments = pgTable('scanned_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').references(() => careProfiles.id, { onDelete: 'cascade' }),
  type: text('type'),
  description: text('description'),
  extractedData: jsonb('extracted_data').default({}),
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Push Subscriptions ────────────────────────────────────────────────────────
export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ── Health Summaries ──────────────────────────────────────────────────────────
export const healthSummaries = pgTable('health_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').references(() => careProfiles.id, { onDelete: 'cascade' }),
  summary: jsonb('summary').notNull(),
  healthScore: integer('health_score'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(
    sql`now() + interval '24 hours'`
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Treatment Cycles ─────────────────────────────────────────────────────────
export const treatmentCycles = pgTable('treatment_cycles', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  cycleNumber: integer('cycle_number').notNull(),
  startDate: date('start_date').notNull(),
  cycleLengthDays: integer('cycle_length_days').notNull().default(21),
  regimenName: text('regimen_name'),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Community (anonymous caregiver forum) ─────────────────────────────────
export const communityPosts = pgTable('community_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  // userId stored internally for moderation only — never exposed publicly
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // Cancer type tag (e.g. "colorectal cancer", "breast cancer")
  cancerType: text('cancer_type').notNull(),
  // Role of the poster: 'caregiver' | 'patient'
  authorRole: text('author_role').notNull().default('caregiver'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  replyCount: integer('reply_count').notNull().default(0),
  isPinned: boolean('is_pinned').notNull().default(false),
  isModerated: boolean('is_moderated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const communityReplies = pgTable('community_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => communityPosts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cancerType: text('cancer_type').notNull(),
  authorRole: text('author_role').notNull().default('caregiver'),
  body: text('body').notNull(),
  upvotes: integer('upvotes').notNull().default(0),
  isModerated: boolean('is_moderated').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const communityUpvotes = pgTable('community_upvotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull(), // postId or replyId
  targetType: text('target_type').notNull(), // 'post' | 'reply'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex('community_upvotes_user_target_unique').on(t.userId, t.targetId, t.targetType),
])

// ── Wellness Check-ins ────────────────────────────────────────────────────────
export const wellnessCheckins = pgTable('wellness_checkins', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  reportedByUserId: uuid('reported_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  mood: integer('mood').notNull(), // 1-5
  pain: integer('pain').notNull(), // 0-10
  energy: text('energy').notNull(), // 'low' | 'medium' | 'high'
  sleep: text('sleep').notNull(), // 'bad' | 'ok' | 'good'
  notes: text('notes'),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  profileTimeIdx: index('wellness_checkins_profile_time_idx').on(t.careProfileId, t.checkedInAt),
}))

// ── Symptom Insights ──────────────────────────────────────────────────────────
export const symptomInsights = pgTable('symptom_insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'trend' | 'correlation' | 'anomaly' | 'milestone'
  severity: text('severity').notNull(), // 'critical' | 'warning' | 'positive' | 'informational' (legacy: 'info' | 'watch' | 'alert')
  status: text('status').notNull().default('active'), // 'active' | 'read' | 'dismissed' | 'archived'
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  profileTimeIdx: index('symptom_insights_profile_time_idx').on(t.careProfileId, t.createdAt),
}))

// ── Notification Deliveries ───────────────────────────────────────────────────
export const notificationDeliveries = pgTable('notification_deliveries', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  category: text('category').notNull(), // 'clinical' | 'emotional' | 'caregiver_awareness' | 'caregiver_selfcare' | 'threshold_alert'
  title: text('title').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Care Team Activity Log ────────────────────────────────────────────────────
export const careTeamActivityLog = pgTable('care_team_activity_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'logged_meds' | 'completed_checkin' | 'viewed_summary' | 'shared_link' | 'exported_pdf'
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Care Groups ───────────────────────────────────────────────────────────────
export const careGroups = pgTable('care_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const careGroupMembers = pgTable('care_group_members', {
  careGroupId: uuid('care_group_id').notNull().references(() => careGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),  // 'owner' | 'member' — group leadership axis
  // ── Caregiver split (migration 012) ────────────────────────────────────────
  userType: text('user_type').notNull().default('patient'),  // 'patient' | 'caregiver' — user type axis
  relationship: text('relationship'),                         // 'spouse'|'parent'|'child'|'sibling'|'friend'|'other' (null for patients)
  perms: jsonb('perms').notNull().default({}),                // { can_read_meds, can_read_appts, can_read_labs, can_chat, can_edit_appts }
  paused: boolean('paused').notNull().default(false),         // patient's privacy mute toggle (deferred UI — see TODOS)
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.careGroupId, t.userId] }),
}))

export const careGroupInvites = pgTable('care_group_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  careGroupId: uuid('care_group_id').notNull().references(() => careGroups.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  usedBy: uuid('used_by').references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ── Care Group Codes (migration 012) ──────────────────────────────────────────
// 5-char invite codes (Crockford base32 minus 0/O/1/I/L/U). Replaces the long
// invite token for new caregiver onboarding flows. Old `careGroupInvites`
// coexists for 30 days behind a deprecation header.
export const careGroupCodes = pgTable('care_group_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  careGroupId: uuid('care_group_id').notNull().references(() => careGroups.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  maxUses: integer('max_uses').notNull().default(5),
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
})

// ── Care Group Join Requests (migration 012) ──────────────────────────────────
// Caregiver-first email fallback: when a caregiver downloads the app before
// the patient has sent them a code, they enter the patient's email and the
// patient gets an in-app approval prompt.
export const careGroupJoinRequests = pgTable('care_group_join_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  patientUserId: uuid('patient_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  caregiverUserId: uuid('caregiver_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),  // 'pending' | 'approved' | 'denied' | 'expired'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

// ── Clinical Trials — Mutations ───────────────────────────────────────────────
export const mutations = pgTable('mutations', {
  id:            uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  mutationName:  text('mutation_name').notNull(),
  status:        text('status').notNull().default('unknown'),
  confirmedDate: date('confirmed_date'),
  source:        text('source').notNull().default('manual'),
  createdAt:     timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  careProfileIdx: index('mutations_care_profile_idx').on(table.careProfileId),
}))

// ── Clinical Trials — Trial Matches ──────────────────────────────────────────
export const trialMatches = pgTable('trial_matches', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  careProfileId:        uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  nctId:                text('nct_id').notNull(),
  title:                text('title'),
  matchCategory:        text('match_category').notNull().default('matched'),
  matchScore:           integer('match_score'),
  matchReasons:         text('match_reasons').array().default(sql`'{}'`),
  disqualifyingFactors: text('disqualifying_factors').array().default(sql`'{}'`),
  uncertainFactors:     text('uncertain_factors').array().default(sql`'{}'`),
  eligibilityGaps:      jsonb('eligibility_gaps'),
  phase:                text('phase'),
  enrollmentStatus:     text('enrollment_status'),
  locations:            jsonb('locations'),
  trialUrl:             text('trial_url'),
  notifiedAt:           timestamp('notified_at', { withTimezone: true }),
  lastCheckedAt:        timestamp('last_checked_at', { withTimezone: true }).defaultNow(),
  createdAt:            timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  careProfileNctUniq: uniqueIndex('trial_matches_care_profile_nct_idx').on(table.careProfileId, table.nctId),
  careProfileIdx:     index('trial_matches_care_profile_idx').on(table.careProfileId),
  matchCategoryIdx:   index('trial_matches_match_category_idx').on(table.matchCategory),
  updatedAtIdx:       index('trial_matches_updated_at_idx').on(table.updatedAt),
  notifiedAtNullIdx:  index('trial_matches_notified_at_null_idx')
    .on(table.notifiedAt)
    .where(sql`notified_at IS NULL`),
}))

// ── Clinical Trials — Saved Trials ───────────────────────────────────────────
export const savedTrials = pgTable('saved_trials', {
  id:                        uuid('id').primaryKey().defaultRandom(),
  careProfileId:             uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  nctId:                     text('nct_id').notNull(),
  savedAt:                   timestamp('saved_at', { withTimezone: true }).defaultNow(),
  interestStatus:            text('interest_status').notNull().default('interested'),
  lastKnownEnrollmentStatus: text('last_known_enrollment_status'),
  lastStatusCheckedAt:       timestamp('last_status_checked_at', { withTimezone: true }),
  notifiedOfChangeAt:        timestamp('notified_of_change_at', { withTimezone: true }),
}, (table) => ({
  careProfileNctUniq:   uniqueIndex('saved_trials_care_profile_nct_idx').on(table.careProfileId, table.nctId),
  careProfileIdx:       index('saved_trials_care_profile_idx').on(table.careProfileId),
  lastStatusCheckedIdx: index('saved_trials_last_status_checked_idx').on(table.lastStatusCheckedAt),
}))

// ── Clinical Trials — Matching Queue ─────────────────────────────────────────
export const matchingQueue = pgTable('matching_queue', {
  id:            uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  reason:        text('reason').notNull(),
  status:        text('status').notNull().default('pending'),
  triggeredAt:   timestamp('triggered_at', { withTimezone: true }).defaultNow(),
  claimedAt:     timestamp('claimed_at', { withTimezone: true }),
  processedAt:   timestamp('processed_at', { withTimezone: true }),
  errorMessage:  text('error_message'),
  retryCount:    integer('retry_count').notNull().default(0),
}, (table) => ({
  onePendingPerPatient: uniqueIndex('matching_queue_one_pending_per_patient_idx')
    .on(table.careProfileId)
    .where(sql`status IN ('pending', 'claimed')`),
}))

// ── Clinical Trials — Cron State ─────────────────────────────────────────────
export const cronState = pgTable('cron_state', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ── Medication Observations (migration 016) ────────────────────────────────────
// Caregiver-reported dose events. Neither source overwrites the other — both
// the EHR prescription (medications.dose) and the caregiver report persist.
// Discrepancy detection runs at write time; resolution requires explicit action.
export const medicationObservations = pgTable('medication_observations', {
  id:              uuid('id').primaryKey().defaultRandom(),
  careProfileId:   uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  medicationId:    uuid('medication_id').notNull().references(() => medications.id, { onDelete: 'cascade' }),
  reportedBy:      uuid('reported_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedAt:      timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),

  observationType: text('observation_type').notNull(),  // 'dose_taken' | 'dose_skipped' | 'dose_partial' | 'dose_delayed' | 'other'
  doseReported:    text('dose_reported'),               // null when skipped/other
  notes:           text('notes'),

  discrepancyFlag: boolean('discrepancy_flag').notNull().default(false),
  discrepancyType: text('discrepancy_type'),            // 'DOSE_DIFFERS' | 'MED_NOT_IN_EHR' | 'DOSE_SKIPPED'
  ehrDoseAtTime:   text('ehr_dose_at_time'),            // snapshot of medications.dose at observation time

  resolvedAt:        timestamp('resolved_at', { withTimezone: true }),
  resolvedBy:        uuid('resolved_by').references(() => users.id),
  resolutionAction:  text('resolution_action'),         // 'intentional_change' | 'caregiver_error' | 'clinical_review_needed' | 'no_action'
  resolutionNotes:   text('resolution_notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  careProfileIdx:  index('medication_observations_care_profile_idx').on(t.careProfileId, t.reportedAt),
  medicationIdx:   index('medication_observations_medication_idx').on(t.medicationId, t.reportedAt),
}))
