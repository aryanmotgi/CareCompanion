-- ============================================================
-- Medication Reminders for CareCompanion
-- Scheduled reminders for taking medications
-- ============================================================

create table if not exists medication_reminders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  medication_id uuid references medications(id) on delete cascade not null,
  medication_name text not null,
  dose text,
  reminder_times text[] not null default '{}',  -- e.g. ['08:00', '20:00']
  days_of_week text[] not null default '{"mon","tue","wed","thu","fri","sat","sun"}',
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists med_reminders_user_idx on medication_reminders(user_id, is_active);
create unique index if not exists med_reminders_unique on medication_reminders(user_id, medication_id);

-- Reminder logs: track when meds were taken, missed, or snoozed
create table if not exists reminder_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  reminder_id uuid references medication_reminders(id) on delete cascade not null,
  medication_name text not null,
  scheduled_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'taken', 'snoozed', 'missed')),
  responded_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists reminder_logs_user_idx on reminder_logs(user_id, scheduled_time desc);
create index if not exists reminder_logs_pending_idx on reminder_logs(user_id, status) where status = 'pending';

-- Symptom journal entries
create table if not exists symptom_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  care_profile_id uuid references care_profiles(id) on delete cascade,
  date date not null default current_date,
  pain_level integer check (pain_level between 0 and 10),
  mood text check (mood in ('great', 'good', 'okay', 'bad', 'terrible')),
  sleep_quality text check (sleep_quality in ('great', 'good', 'fair', 'poor', 'terrible')),
  sleep_hours numeric,
  appetite text check (appetite in ('normal', 'increased', 'decreased', 'none')),
  energy text check (energy in ('high', 'normal', 'low', 'very_low')),
  symptoms text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

create index if not exists symptom_entries_user_date_idx on symptom_entries(user_id, date desc);
create unique index if not exists symptom_entries_unique_day on symptom_entries(user_id, date);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table medication_reminders enable row level security;
alter table reminder_logs enable row level security;
alter table symptom_entries enable row level security;

create policy "med_reminders_select" on medication_reminders for select using (auth.uid() = user_id);
create policy "med_reminders_insert" on medication_reminders for insert with check (auth.uid() = user_id);
create policy "med_reminders_update" on medication_reminders for update using (auth.uid() = user_id);
create policy "med_reminders_delete" on medication_reminders for delete using (auth.uid() = user_id);

create policy "reminder_logs_select" on reminder_logs for select using (auth.uid() = user_id);
create policy "reminder_logs_insert" on reminder_logs for insert with check (auth.uid() = user_id);
create policy "reminder_logs_update" on reminder_logs for update using (auth.uid() = user_id);

create policy "symptom_entries_select" on symptom_entries for select using (auth.uid() = user_id);
create policy "symptom_entries_insert" on symptom_entries for insert with check (auth.uid() = user_id);
create policy "symptom_entries_update" on symptom_entries for update using (auth.uid() = user_id);
create policy "symptom_entries_delete" on symptom_entries for delete using (auth.uid() = user_id);
