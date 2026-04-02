-- ============================================================
-- Multi-Patient Support for CareCompanion
-- Allows one caregiver to manage multiple patients
-- ============================================================

-- Add active_profile_id to track which patient is currently selected
alter table auth.users add column if not exists raw_app_meta_data jsonb;
-- We'll use user_metadata instead (already exists), no schema change needed

-- Allow multiple care profiles per user (remove any unique constraint if exists)
-- The table already supports multiple rows per user_id, so no change needed

-- Create a user_preferences table to track active profile
create table if not exists user_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  active_profile_id uuid references care_profiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists user_preferences_user_idx on user_preferences(user_id);

alter table user_preferences enable row level security;

create policy "user_preferences_select" on user_preferences for select using (auth.uid() = user_id);
create policy "user_preferences_insert" on user_preferences for insert with check (auth.uid() = user_id);
create policy "user_preferences_update" on user_preferences for update using (auth.uid() = user_id);
