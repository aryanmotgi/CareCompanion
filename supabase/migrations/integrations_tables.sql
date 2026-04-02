-- ============================================================
-- Integration Tables for CareCompanion
-- Run this in the Supabase SQL Editor AFTER the base tables.
-- ============================================================

-- Connected Apps (OAuth tokens for external integrations)
create table if not exists connected_apps (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  last_synced timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create unique index if not exists connected_apps_user_source
  on connected_apps(user_id, source);

-- Insurance
create table if not exists insurance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  member_id text,
  group_number text,
  deductible_limit numeric,
  deductible_used numeric default 0,
  oop_limit numeric,
  oop_used numeric default 0,
  plan_year integer,
  created_at timestamptz default now()
);

-- Claims
create table if not exists claims (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  service_date date,
  provider_name text,
  billed_amount numeric,
  paid_amount numeric,
  patient_responsibility numeric,
  status text check (status in ('paid', 'denied', 'pending')),
  denial_reason text,
  eob_url text,
  created_at timestamptz default now()
);

-- Prior Authorizations
create table if not exists prior_auths (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  service text not null,
  status text,
  start_date date,
  expiry_date date,
  sessions_approved integer,
  sessions_used integer default 0,
  created_at timestamptz default now()
);

-- FSA / HSA Accounts
create table if not exists fsa_hsa (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  provider text not null,
  account_type text check (account_type in ('fsa', 'hsa')),
  balance numeric default 0,
  contribution_limit numeric,
  plan_year integer,
  last_synced timestamptz,
  created_at timestamptz default now()
);

-- Lab Results
create table if not exists lab_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  test_name text not null,
  value text,
  unit text,
  reference_range text,
  is_abnormal boolean default false,
  date_taken date,
  source text,
  created_at timestamptz default now()
);

-- Notifications
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table connected_apps enable row level security;
alter table insurance enable row level security;
alter table claims enable row level security;
alter table prior_auths enable row level security;
alter table fsa_hsa enable row level security;
alter table lab_results enable row level security;
alter table notifications enable row level security;

-- connected_apps
drop policy if exists "connected_apps_select" on connected_apps;
drop policy if exists "connected_apps_insert" on connected_apps;
drop policy if exists "connected_apps_update" on connected_apps;
drop policy if exists "connected_apps_delete" on connected_apps;

create policy "connected_apps_select" on connected_apps for select using (auth.uid() = user_id);
create policy "connected_apps_insert" on connected_apps for insert with check (auth.uid() = user_id);
create policy "connected_apps_update" on connected_apps for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "connected_apps_delete" on connected_apps for delete using (auth.uid() = user_id);

-- insurance
drop policy if exists "insurance_select" on insurance;
drop policy if exists "insurance_insert" on insurance;
drop policy if exists "insurance_update" on insurance;
drop policy if exists "insurance_delete" on insurance;

create policy "insurance_select" on insurance for select using (auth.uid() = user_id);
create policy "insurance_insert" on insurance for insert with check (auth.uid() = user_id);
create policy "insurance_update" on insurance for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "insurance_delete" on insurance for delete using (auth.uid() = user_id);

-- claims
drop policy if exists "claims_select" on claims;
drop policy if exists "claims_insert" on claims;
drop policy if exists "claims_delete" on claims;

create policy "claims_select" on claims for select using (auth.uid() = user_id);
create policy "claims_insert" on claims for insert with check (auth.uid() = user_id);
create policy "claims_delete" on claims for delete using (auth.uid() = user_id);

-- prior_auths
drop policy if exists "prior_auths_select" on prior_auths;
drop policy if exists "prior_auths_insert" on prior_auths;
drop policy if exists "prior_auths_update" on prior_auths;
drop policy if exists "prior_auths_delete" on prior_auths;

create policy "prior_auths_select" on prior_auths for select using (auth.uid() = user_id);
create policy "prior_auths_insert" on prior_auths for insert with check (auth.uid() = user_id);
create policy "prior_auths_update" on prior_auths for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "prior_auths_delete" on prior_auths for delete using (auth.uid() = user_id);

-- fsa_hsa
drop policy if exists "fsa_hsa_select" on fsa_hsa;
drop policy if exists "fsa_hsa_insert" on fsa_hsa;
drop policy if exists "fsa_hsa_update" on fsa_hsa;
drop policy if exists "fsa_hsa_delete" on fsa_hsa;

create policy "fsa_hsa_select" on fsa_hsa for select using (auth.uid() = user_id);
create policy "fsa_hsa_insert" on fsa_hsa for insert with check (auth.uid() = user_id);
create policy "fsa_hsa_update" on fsa_hsa for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fsa_hsa_delete" on fsa_hsa for delete using (auth.uid() = user_id);

-- lab_results
drop policy if exists "lab_results_select" on lab_results;
drop policy if exists "lab_results_insert" on lab_results;
drop policy if exists "lab_results_delete" on lab_results;

create policy "lab_results_select" on lab_results for select using (auth.uid() = user_id);
create policy "lab_results_insert" on lab_results for insert with check (auth.uid() = user_id);
create policy "lab_results_delete" on lab_results for delete using (auth.uid() = user_id);

-- notifications
drop policy if exists "notifications_select" on notifications;
drop policy if exists "notifications_insert" on notifications;
drop policy if exists "notifications_update" on notifications;
drop policy if exists "notifications_delete" on notifications;

create policy "notifications_select" on notifications for select using (auth.uid() = user_id);
create policy "notifications_insert" on notifications for insert with check (auth.uid() = user_id);
create policy "notifications_update" on notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_delete" on notifications for delete using (auth.uid() = user_id);
