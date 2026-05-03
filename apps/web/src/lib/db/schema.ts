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
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

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
  city:    text('city'),
  state:   text('state'),
  zipCode: text('zip_code'),
  fieldOverrides: jsonb('field_overrides'),            // { cancerType: true, stage: true, ... } — FHIR sync skips true fields
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
})

// ── Medications ───────────────────────────────────────────────────────────────
export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dose: text('dose'),
  frequency: text('frequency'),
  prescribingDoctor: text('prescribing_doctor'),
  refillDate: text('refill_date'),
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
})

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
})

// ── Conversation Summaries ────────────────────────────────────────────────────
export const conversationSummaries = pgTable('conversation_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
  topics: text('topics').array().default(sql`'{}'`),
  messageCount: integer('message_count').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
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
})

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
})

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
})

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
})

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
  viewCount: integer('view_count').default(0),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

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
})

// ── Symptom Insights ──────────────────────────────────────────────────────────
export const symptomInsights = pgTable('symptom_insights', {
  id: uuid('id').defaultRandom().primaryKey(),
  careProfileId: uuid('care_profile_id').notNull().references(() => careProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'trend' | 'correlation' | 'anomaly' | 'milestone'
  severity: text('severity').notNull(), // 'info' | 'watch' | 'alert'
  status: text('status').notNull().default('active'), // 'active' | 'read' | 'dismissed' | 'archived'
  title: text('title').notNull(),
  body: text('body').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
})

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
  role: text('role').notNull(),  // 'owner' | 'member'
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
