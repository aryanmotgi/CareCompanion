-- Add missing foreign key constraints with ON DELETE CASCADE
-- Fixes HIPAA compliance issue: orphaned data when user accounts are deleted

-- care_profiles → users
ALTER TABLE care_profiles DROP CONSTRAINT IF EXISTS care_profiles_user_id_fkey;
ALTER TABLE care_profiles ADD CONSTRAINT care_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- messages → users
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- medications → care_profiles
ALTER TABLE medications DROP CONSTRAINT IF EXISTS medications_care_profile_id_fkey;
ALTER TABLE medications ADD CONSTRAINT medications_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- doctors → care_profiles
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_care_profile_id_fkey;
ALTER TABLE doctors ADD CONSTRAINT doctors_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- appointments → care_profiles
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_care_profile_id_fkey;
ALTER TABLE appointments ADD CONSTRAINT appointments_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- documents → care_profiles
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_care_profile_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- connected_apps → users
ALTER TABLE connected_apps DROP CONSTRAINT IF EXISTS connected_apps_user_id_fkey;
ALTER TABLE connected_apps ADD CONSTRAINT connected_apps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- insurance → users
ALTER TABLE insurance DROP CONSTRAINT IF EXISTS insurance_user_id_fkey;
ALTER TABLE insurance ADD CONSTRAINT insurance_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- claims → users
ALTER TABLE claims DROP CONSTRAINT IF EXISTS claims_user_id_fkey;
ALTER TABLE claims ADD CONSTRAINT claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- prior_auths → users
ALTER TABLE prior_auths DROP CONSTRAINT IF EXISTS prior_auths_user_id_fkey;
ALTER TABLE prior_auths ADD CONSTRAINT prior_auths_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- fsa_hsa → users
ALTER TABLE fsa_hsa DROP CONSTRAINT IF EXISTS fsa_hsa_user_id_fkey;
ALTER TABLE fsa_hsa ADD CONSTRAINT fsa_hsa_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- lab_results → users
ALTER TABLE lab_results DROP CONSTRAINT IF EXISTS lab_results_user_id_fkey;
ALTER TABLE lab_results ADD CONSTRAINT lab_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- notifications → users
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- memories → users
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_user_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- memories → care_profiles
ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_care_profile_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- conversation_summaries → users
ALTER TABLE conversation_summaries DROP CONSTRAINT IF EXISTS conversation_summaries_user_id_fkey;
ALTER TABLE conversation_summaries ADD CONSTRAINT conversation_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- user_preferences → users
ALTER TABLE user_preferences DROP CONSTRAINT IF EXISTS user_preferences_user_id_fkey;
ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- user_settings → users
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_user_id_fkey;
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- care_team_members → care_profiles
ALTER TABLE care_team_members DROP CONSTRAINT IF EXISTS care_team_members_care_profile_id_fkey;
ALTER TABLE care_team_members ADD CONSTRAINT care_team_members_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- care_team_members → users (member)
ALTER TABLE care_team_members DROP CONSTRAINT IF EXISTS care_team_members_user_id_fkey;
ALTER TABLE care_team_members ADD CONSTRAINT care_team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- care_team_members → users (inviter, nullable → SET NULL)
ALTER TABLE care_team_members DROP CONSTRAINT IF EXISTS care_team_members_invited_by_fkey;
ALTER TABLE care_team_members ADD CONSTRAINT care_team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;

-- care_team_invites → care_profiles
ALTER TABLE care_team_invites DROP CONSTRAINT IF EXISTS care_team_invites_care_profile_id_fkey;
ALTER TABLE care_team_invites ADD CONSTRAINT care_team_invites_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- care_team_invites → users (inviter)
ALTER TABLE care_team_invites DROP CONSTRAINT IF EXISTS care_team_invites_invited_by_fkey;
ALTER TABLE care_team_invites ADD CONSTRAINT care_team_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE;

-- care_team_activity → care_profiles
ALTER TABLE care_team_activity DROP CONSTRAINT IF EXISTS care_team_activity_care_profile_id_fkey;
ALTER TABLE care_team_activity ADD CONSTRAINT care_team_activity_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- care_team_activity → users (nullable → SET NULL)
ALTER TABLE care_team_activity DROP CONSTRAINT IF EXISTS care_team_activity_user_id_fkey;
ALTER TABLE care_team_activity ADD CONSTRAINT care_team_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- medication_reminders → users
ALTER TABLE medication_reminders DROP CONSTRAINT IF EXISTS medication_reminders_user_id_fkey;
ALTER TABLE medication_reminders ADD CONSTRAINT medication_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- medication_reminders → medications
ALTER TABLE medication_reminders DROP CONSTRAINT IF EXISTS medication_reminders_medication_id_fkey;
ALTER TABLE medication_reminders ADD CONSTRAINT medication_reminders_medication_id_fkey FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE;

-- reminder_logs → users
ALTER TABLE reminder_logs DROP CONSTRAINT IF EXISTS reminder_logs_user_id_fkey;
ALTER TABLE reminder_logs ADD CONSTRAINT reminder_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- reminder_logs → medication_reminders
ALTER TABLE reminder_logs DROP CONSTRAINT IF EXISTS reminder_logs_reminder_id_fkey;
ALTER TABLE reminder_logs ADD CONSTRAINT reminder_logs_reminder_id_fkey FOREIGN KEY (reminder_id) REFERENCES medication_reminders(id) ON DELETE CASCADE;

-- symptom_entries → users
ALTER TABLE symptom_entries DROP CONSTRAINT IF EXISTS symptom_entries_user_id_fkey;
ALTER TABLE symptom_entries ADD CONSTRAINT symptom_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- symptom_entries → care_profiles
ALTER TABLE symptom_entries DROP CONSTRAINT IF EXISTS symptom_entries_care_profile_id_fkey;
ALTER TABLE symptom_entries ADD CONSTRAINT symptom_entries_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- audit_logs → users (nullable → SET NULL to preserve audit trail)
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- shared_links → users
ALTER TABLE shared_links DROP CONSTRAINT IF EXISTS shared_links_user_id_fkey;
ALTER TABLE shared_links ADD CONSTRAINT shared_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- shared_links → care_profiles
ALTER TABLE shared_links DROP CONSTRAINT IF EXISTS shared_links_care_profile_id_fkey;
ALTER TABLE shared_links ADD CONSTRAINT shared_links_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- scanned_documents → users
ALTER TABLE scanned_documents DROP CONSTRAINT IF EXISTS scanned_documents_user_id_fkey;
ALTER TABLE scanned_documents ADD CONSTRAINT scanned_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- scanned_documents → care_profiles
ALTER TABLE scanned_documents DROP CONSTRAINT IF EXISTS scanned_documents_care_profile_id_fkey;
ALTER TABLE scanned_documents ADD CONSTRAINT scanned_documents_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;

-- health_summaries → users
ALTER TABLE health_summaries DROP CONSTRAINT IF EXISTS health_summaries_user_id_fkey;
ALTER TABLE health_summaries ADD CONSTRAINT health_summaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- health_summaries → care_profiles
ALTER TABLE health_summaries DROP CONSTRAINT IF EXISTS health_summaries_care_profile_id_fkey;
ALTER TABLE health_summaries ADD CONSTRAINT health_summaries_care_profile_id_fkey FOREIGN KEY (care_profile_id) REFERENCES care_profiles(id) ON DELETE CASCADE;
