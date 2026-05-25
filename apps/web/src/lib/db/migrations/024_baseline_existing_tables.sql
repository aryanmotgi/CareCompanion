-- 024_baseline_existing_tables.sql
-- Baseline migration documenting 27 tables that exist in production but
-- were never tracked in migrations/. Generated from schema.ts via drizzle-kit
-- on 2026-05-24. Uses IF NOT EXISTS so safe to run on prod (no-op) AND on
-- fresh databases (creates everything). CREATE TABLE only — incremental
-- ALTER / INDEX / CONSTRAINT additions belong in later numbered migrations.
-- Source: closes audit gap from AUDIT_CODE_HEALTH.md (Apr 24 prod drift incident).

CREATE TABLE IF NOT EXISTS "allergies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"code" text,
	"display" text NOT NULL,
	"reaction" text,
	"criticality" text,
	"healthkit_fhir_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "allergies_healthkit_fhir_id_unique" UNIQUE("healthkit_fhir_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_events" (
	"id" integer PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"user_id_hash" text,
	"session_id" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_version_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_group_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"max_uses" integer DEFAULT 5 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "care_group_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_group_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_group_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_by" uuid NOT NULL,
	"used_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "care_group_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_group_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_user_id" uuid NOT NULL,
	"caregiver_user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_group_members" (
	"care_group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"user_type" text DEFAULT 'patient' NOT NULL,
	"relationship" text,
	"perms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "care_group_members_care_group_id_user_id_pk" PRIMARY KEY("care_group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "care_team_activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"code" text,
	"display" text NOT NULL,
	"clinical_status" text,
	"onset_date_time" timestamp with time zone,
	"healthkit_fhir_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "conditions_healthkit_fhir_id_unique" UNIQUE("healthkit_fhir_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"tags" text[] DEFAULT '{}',
	"last_message_preview" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cron_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "immunizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"code" text,
	"display" text NOT NULL,
	"occurrence_date_time" timestamp with time zone,
	"healthkit_fhir_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "immunizations_healthkit_fhir_id_unique" UNIQUE("healthkit_fhir_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matching_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now(),
	"claimed_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "medication_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"medication_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observation_type" text NOT NULL,
	"dose_reported" text,
	"notes" text,
	"discrepancy_flag" boolean DEFAULT false NOT NULL,
	"discrepancy_type" text,
	"ehr_dose_at_time" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_action" text,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "memory_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"memory_ids" uuid[] NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mutations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"mutation_name" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"confirmed_date" date,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"code" text,
	"display" text NOT NULL,
	"performed_date_time" timestamp with time zone,
	"healthkit_fhir_id" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "procedures_healthkit_fhir_id_unique" UNIQUE("healthkit_fhir_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"nct_id" text NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now(),
	"interest_status" text DEFAULT 'interested' NOT NULL,
	"last_known_enrollment_status" text,
	"last_status_checked_at" timestamp with time zone,
	"notified_of_change_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "symptom_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "treatment_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"cycle_number" integer NOT NULL,
	"start_date" date NOT NULL,
	"cycle_length_days" integer DEFAULT 21 NOT NULL,
	"regimen_name" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trial_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"nct_id" text NOT NULL,
	"title" text,
	"match_category" text DEFAULT 'matched' NOT NULL,
	"match_score" integer,
	"match_reasons" text[] DEFAULT '{}',
	"disqualifying_factors" text[] DEFAULT '{}',
	"uncertain_factors" text[] DEFAULT '{}',
	"eligibility_gaps" jsonb,
	"phase" text,
	"enrollment_status" text,
	"locations" jsonb,
	"trial_url" text,
	"notified_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_sub" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"usage_date" date DEFAULT CURRENT_DATE NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_create_tokens" integer DEFAULT 0 NOT NULL,
	"reserved_input_tokens" integer DEFAULT 0 NOT NULL,
	"model_calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wellness_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"reported_by_user_id" uuid,
	"mood" integer NOT NULL,
	"pain" integer NOT NULL,
	"energy" text NOT NULL,
	"sleep" text NOT NULL,
	"notes" text,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wellness_vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"care_profile_id" uuid NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"steps" integer,
	"heart_rate" numeric,
	"sleep_hours" numeric,
	"body_mass" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
