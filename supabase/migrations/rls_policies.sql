-- ============================================================
-- RLS Policies for CareCompanion
-- Run this in the Supabase SQL Editor.
-- These are idempotent — safe to re-run.
-- ============================================================

-- Enable RLS on all tables (no-op if already enabled)
alter table messages enable row level security;
alter table care_profiles enable row level security;
alter table medications enable row level security;
alter table doctors enable row level security;
alter table appointments enable row level security;
alter table documents enable row level security;

-- ============================================================
-- Drop existing broad "for all" policies if they exist
-- ============================================================
drop policy if exists "users own messages" on messages;
drop policy if exists "users own care_profiles" on care_profiles;
drop policy if exists "users own medications" on medications;
drop policy if exists "users own doctors" on doctors;
drop policy if exists "users own appointments" on appointments;
drop policy if exists "users own documents" on documents;

-- Also drop the granular ones in case this script is re-run
drop policy if exists "messages_select" on messages;
drop policy if exists "messages_insert" on messages;
drop policy if exists "care_profiles_select" on care_profiles;
drop policy if exists "care_profiles_insert" on care_profiles;
drop policy if exists "care_profiles_update" on care_profiles;
drop policy if exists "medications_select" on medications;
drop policy if exists "medications_insert" on medications;
drop policy if exists "medications_delete" on medications;
drop policy if exists "doctors_select" on doctors;
drop policy if exists "doctors_insert" on doctors;
drop policy if exists "doctors_delete" on doctors;
drop policy if exists "appointments_select" on appointments;
drop policy if exists "appointments_insert" on appointments;
drop policy if exists "appointments_delete" on appointments;

-- ============================================================
-- messages: SELECT and INSERT where user_id = auth.uid()
-- ============================================================
create policy "messages_select"
  on messages for select
  using (auth.uid() = user_id);

create policy "messages_insert"
  on messages for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- care_profiles: SELECT, INSERT, UPDATE where user_id = auth.uid()
-- ============================================================
create policy "care_profiles_select"
  on care_profiles for select
  using (auth.uid() = user_id);

create policy "care_profiles_insert"
  on care_profiles for insert
  with check (auth.uid() = user_id);

create policy "care_profiles_update"
  on care_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- medications: SELECT, INSERT, DELETE
-- where care_profile_id belongs to the user's profile
-- ============================================================
create policy "medications_select"
  on medications for select
  using (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

create policy "medications_insert"
  on medications for insert
  with check (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

create policy "medications_delete"
  on medications for delete
  using (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

-- ============================================================
-- doctors: SELECT, INSERT, DELETE
-- where care_profile_id belongs to the user's profile
-- ============================================================
create policy "doctors_select"
  on doctors for select
  using (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

create policy "doctors_insert"
  on doctors for insert
  with check (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

create policy "doctors_delete"
  on doctors for delete
  using (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

-- ============================================================
-- appointments: SELECT, INSERT, DELETE
-- where care_profile_id belongs to the user's profile
-- ============================================================
create policy "appointments_select"
  on appointments for select
  using (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

create policy "appointments_insert"
  on appointments for insert
  with check (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );

create policy "appointments_delete"
  on appointments for delete
  using (
    care_profile_id in (
      select id from care_profiles where user_id = auth.uid()
    )
  );
