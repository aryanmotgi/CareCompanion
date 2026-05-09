-- ============================================================
-- Care Team RLS Fix: Allow care team members to access shared data
-- Tables with care_profile_id: medications, doctors, appointments, documents
-- Tables with user_id: lab_results, claims, insurance
-- ============================================================

-- ============================================================
-- 1. MEDICATIONS (keyed by care_profile_id)
-- ============================================================

-- SELECT: owner OR any care team member
drop policy if exists "medications_select" on medications;
drop policy if exists "medications_select_v2" on medications;

create policy "medications_select_v2" on medications for select using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (select care_profile_id from care_team_members where user_id = auth.uid())
);

-- INSERT: owner OR editor
drop policy if exists "medications_insert" on medications;
drop policy if exists "medications_insert_v2" on medications;

create policy "medications_insert_v2" on medications for insert with check (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

-- UPDATE: owner OR editor
drop policy if exists "medications_update" on medications;
drop policy if exists "medications_update_v2" on medications;

create policy "medications_update_v2" on medications for update using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

-- DELETE: owner OR editor
drop policy if exists "medications_delete" on medications;
drop policy if exists "medications_delete_v2" on medications;

create policy "medications_delete_v2" on medications for delete using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

-- ============================================================
-- 2. DOCTORS (keyed by care_profile_id)
-- ============================================================

drop policy if exists "doctors_select" on doctors;
drop policy if exists "doctors_select_v2" on doctors;

create policy "doctors_select_v2" on doctors for select using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (select care_profile_id from care_team_members where user_id = auth.uid())
);

drop policy if exists "doctors_insert" on doctors;
drop policy if exists "doctors_insert_v2" on doctors;

create policy "doctors_insert_v2" on doctors for insert with check (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

drop policy if exists "doctors_update" on doctors;
drop policy if exists "doctors_update_v2" on doctors;

create policy "doctors_update_v2" on doctors for update using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

drop policy if exists "doctors_delete" on doctors;
drop policy if exists "doctors_delete_v2" on doctors;

create policy "doctors_delete_v2" on doctors for delete using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

-- ============================================================
-- 3. APPOINTMENTS (keyed by care_profile_id)
-- ============================================================

drop policy if exists "appointments_select" on appointments;
drop policy if exists "appointments_select_v2" on appointments;

create policy "appointments_select_v2" on appointments for select using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (select care_profile_id from care_team_members where user_id = auth.uid())
);

drop policy if exists "appointments_insert" on appointments;
drop policy if exists "appointments_insert_v2" on appointments;

create policy "appointments_insert_v2" on appointments for insert with check (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

drop policy if exists "appointments_update" on appointments;
drop policy if exists "appointments_update_v2" on appointments;

create policy "appointments_update_v2" on appointments for update using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

drop policy if exists "appointments_delete" on appointments;
drop policy if exists "appointments_delete_v2" on appointments;

create policy "appointments_delete_v2" on appointments for delete using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

-- ============================================================
-- 4. DOCUMENTS (keyed by care_profile_id)
-- ============================================================

drop policy if exists "Users read own documents" on documents;
drop policy if exists "documents_select_v2" on documents;

create policy "documents_select_v2" on documents for select using (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (select care_profile_id from care_team_members where user_id = auth.uid())
);

drop policy if exists "Users insert own documents" on documents;
drop policy if exists "documents_insert_v2" on documents;

create policy "documents_insert_v2" on documents for insert with check (
  care_profile_id in (select id from care_profiles where user_id = auth.uid())
  or care_profile_id in (
    select care_profile_id from care_team_members
    where user_id = auth.uid() and role in ('owner', 'editor')
  )
);

-- ============================================================
-- 5. LAB_RESULTS (keyed by user_id — join through care_profiles)
-- ============================================================

drop policy if exists "lab_results_select" on lab_results;
drop policy if exists "lab_results_select_v2" on lab_results;

create policy "lab_results_select_v2" on lab_results for select using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid()
  )
);

drop policy if exists "lab_results_insert" on lab_results;
drop policy if exists "lab_results_insert_v2" on lab_results;

create policy "lab_results_insert_v2" on lab_results for insert with check (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);

drop policy if exists "lab_results_delete" on lab_results;
drop policy if exists "lab_results_delete_v2" on lab_results;

create policy "lab_results_delete_v2" on lab_results for delete using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);

-- ============================================================
-- 6. CLAIMS (keyed by user_id — join through care_profiles)
-- ============================================================

drop policy if exists "claims_select" on claims;
drop policy if exists "claims_select_v2" on claims;

create policy "claims_select_v2" on claims for select using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid()
  )
);

drop policy if exists "claims_insert" on claims;
drop policy if exists "claims_insert_v2" on claims;

create policy "claims_insert_v2" on claims for insert with check (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);

drop policy if exists "claims_delete" on claims;
drop policy if exists "claims_delete_v2" on claims;

create policy "claims_delete_v2" on claims for delete using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);

-- ============================================================
-- 7. INSURANCE (keyed by user_id — join through care_profiles)
-- ============================================================

drop policy if exists "insurance_select" on insurance;
drop policy if exists "insurance_select_v2" on insurance;

create policy "insurance_select_v2" on insurance for select using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid()
  )
);

drop policy if exists "insurance_insert" on insurance;
drop policy if exists "insurance_insert_v2" on insurance;

create policy "insurance_insert_v2" on insurance for insert with check (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);

drop policy if exists "insurance_update" on insurance;
drop policy if exists "insurance_update_v2" on insurance;

create policy "insurance_update_v2" on insurance for update using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);

drop policy if exists "insurance_delete" on insurance;
drop policy if exists "insurance_delete_v2" on insurance;

create policy "insurance_delete_v2" on insurance for delete using (
  user_id = auth.uid()
  or user_id in (
    select cp.user_id from care_profiles cp
    inner join care_team_members ctm on ctm.care_profile_id = cp.id
    where ctm.user_id = auth.uid() and ctm.role in ('owner', 'editor')
  )
);
