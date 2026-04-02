-- ============================================================
-- Memories Table for CareCompanion Long-Term Memory System
-- Run this in the Supabase SQL Editor AFTER the integration tables.
-- ============================================================

-- Memories: persistent facts extracted from every conversation
create table if not exists memories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  care_profile_id uuid references care_profiles(id) on delete cascade,
  category text not null check (category in (
    'medication', 'condition', 'allergy', 'insurance', 'financial',
    'appointment', 'preference', 'family', 'provider', 'lab_result',
    'lifestyle', 'legal', 'other'
  )),
  fact text not null,
  source text not null default 'conversation',  -- conversation, photo_scan, fhir_sync, manual
  confidence text not null default 'high' check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz default now(),
  last_referenced timestamptz default now()
);

-- Indexes for fast lookup
create index if not exists memories_user_id_idx on memories(user_id);
create index if not exists memories_category_idx on memories(user_id, category);
create index if not exists memories_last_referenced_idx on memories(user_id, last_referenced desc);

-- Conversation summaries: end-of-conversation digests
create table if not exists conversation_summaries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  summary text not null,
  topics text[] default '{}',
  message_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists conversation_summaries_user_idx
  on conversation_summaries(user_id, created_at desc);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table memories enable row level security;
alter table conversation_summaries enable row level security;

-- memories
create policy "memories_select" on memories for select using (auth.uid() = user_id);
create policy "memories_insert" on memories for insert with check (auth.uid() = user_id);
create policy "memories_update" on memories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "memories_delete" on memories for delete using (auth.uid() = user_id);

-- conversation_summaries
create policy "conversation_summaries_select" on conversation_summaries for select using (auth.uid() = user_id);
create policy "conversation_summaries_insert" on conversation_summaries for insert with check (auth.uid() = user_id);
create policy "conversation_summaries_delete" on conversation_summaries for delete using (auth.uid() = user_id);
