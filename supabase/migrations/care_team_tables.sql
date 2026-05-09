-- ============================================================
-- Care Team Sharing for CareCompanion
-- Enables multiple caregivers to access one patient's profile
-- ============================================================

-- Care team members: maps users to care profiles with roles
create table if not exists care_team_members (
  id uuid default gen_random_uuid() primary key,
  care_profile_id uuid references care_profiles(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  invited_by uuid references auth.users(id),
  joined_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Each user can only be on a care team once per profile
create unique index if not exists care_team_unique_member
  on care_team_members(care_profile_id, user_id);

create index if not exists care_team_user_idx on care_team_members(user_id);
create index if not exists care_team_profile_idx on care_team_members(care_profile_id);

-- Care team invitations: pending invites sent by email
create table if not exists care_team_invites (
  id uuid default gen_random_uuid() primary key,
  care_profile_id uuid references care_profiles(id) on delete cascade not null,
  invited_email text not null,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  invited_by uuid references auth.users(id) not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '7 days')
);

create index if not exists care_team_invites_email_idx on care_team_invites(invited_email, status);

-- Activity feed: track who did what on the care profile
create table if not exists care_team_activity (
  id uuid default gen_random_uuid() primary key,
  care_profile_id uuid references care_profiles(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  action text not null,  -- e.g. 'added medication Metformin', 'updated appointment'
  created_at timestamptz default now()
);

create index if not exists care_team_activity_profile_idx
  on care_team_activity(care_profile_id, created_at desc);

-- ============================================================
-- Seed existing owners into care_team_members
-- Every current care_profile owner gets an 'owner' record
-- ============================================================
insert into care_team_members (care_profile_id, user_id, role)
select id, user_id, 'owner' from care_profiles
on conflict (care_profile_id, user_id) do nothing;

-- ============================================================
-- RLS Policies
-- ============================================================

alter table care_team_members enable row level security;
alter table care_team_invites enable row level security;
alter table care_team_activity enable row level security;

-- care_team_members: users can see teams they belong to
create policy "care_team_members_select" on care_team_members
  for select using (
    user_id = auth.uid()
    or care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid()
    )
  );

-- Only owners can insert/update/delete team members
create policy "care_team_members_insert" on care_team_members
  for insert with check (
    care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "care_team_members_update" on care_team_members
  for update using (
    care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "care_team_members_delete" on care_team_members
  for delete using (
    -- Owners can remove anyone, or users can remove themselves
    care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid() and role = 'owner'
    )
    or user_id = auth.uid()
  );

-- care_team_invites: owners can manage, invited users can see their own
create policy "care_team_invites_select" on care_team_invites
  for select using (
    invited_by = auth.uid()
    or invited_email in (select email from auth.users where id = auth.uid())
    or care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "care_team_invites_insert" on care_team_invites
  for insert with check (
    care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

create policy "care_team_invites_update" on care_team_invites
  for update using (
    invited_email in (select email from auth.users where id = auth.uid())
    or invited_by = auth.uid()
  );

-- care_team_activity: visible to all team members
create policy "care_team_activity_select" on care_team_activity
  for select using (
    care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid()
    )
  );

-- Any team member can log activity (inserted server-side via admin client)
create policy "care_team_activity_insert" on care_team_activity
  for insert with check (
    care_profile_id in (
      select care_profile_id from care_team_members where user_id = auth.uid()
    )
  );
