-- ============================================================================
-- Elsewhere v1 — Supabase schema
-- Shared workspace for Brad + Sam (and reusable for another two-person workspace)
-- Run this entire file in Supabase SQL Editor once.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  created_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Elsewhere',
  join_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (user_id)
);

create table if not exists public.possibilities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  audience text not null check (audience in ('Brad','Sam','Both')),
  title text not null,
  url text,
  region_key text,
  location text,
  status text not null default 'Interesting',
  why_interesting text,
  notes text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists possibilities_workspace_idx on public.possibilities(workspace_id);
create index if not exists possibilities_region_idx on public.possibilities(workspace_id, region_key);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  possibility_id uuid not null references public.possibilities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction text not null check (reaction in ('yeah_nah','nah_yeah','yeah_nah_yeah','love','hmm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (possibility_id, user_id)
);

create index if not exists reactions_workspace_idx on public.reactions(workspace_id);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  region_key text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists observations_workspace_idx on public.observations(workspace_id);

create table if not exists public.map_pins (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  audience text not null default 'Both' check (audience in ('Brad','Sam','Both')),
  region_key text,
  notes text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists map_pins_workspace_idx on public.map_pins(workspace_id);
create index if not exists map_pins_region_idx on public.map_pins(workspace_id, region_key);

-- ---------------------------------------------------------------------------
-- Utility triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists possibilities_set_updated_at on public.possibilities;
create trigger possibilities_set_updated_at
before update on public.possibilities
for each row execute function public.set_updated_at();

drop trigger if exists reactions_set_updated_at on public.reactions;
create trigger reactions_set_updated_at
before update on public.reactions
for each row execute function public.set_updated_at();

drop trigger if exists observations_set_updated_at on public.observations;
create trigger observations_set_updated_at
before update on public.observations
for each row execute function public.set_updated_at();

drop trigger if exists map_pins_set_updated_at on public.map_pins;
create trigger map_pins_set_updated_at
before update on public.map_pins
for each row execute function public.set_updated_at();

-- Create a profile automatically when a Supabase Auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Member'), '@', 1), 'Member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Safe if the schema is applied after test users already exist.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(u.email, 'Member'), '@', 1), 'Member')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS helper functions
-- SECURITY DEFINER avoids recursive workspace_members policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role = 'owner'
  );
$$;

create or replace function public.shares_workspace(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid()
      and them.user_id = target_user_id
  );
$$;

-- ---------------------------------------------------------------------------
-- Workspace onboarding RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_elsewhere_workspace(workspace_name text default 'Elsewhere')
returns table (workspace_id uuid, join_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  new_join_code text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to an Elsewhere workspace.';
  end if;

  loop
    new_join_code := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    exit when not exists (select 1 from public.workspaces where workspaces.join_code = new_join_code);
  end loop;

  insert into public.workspaces (name, join_code, created_by)
  values (coalesce(nullif(trim(workspace_name), ''), 'Elsewhere'), new_join_code, auth.uid())
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, auth.uid(), 'owner');

  return query select new_workspace_id, new_join_code;
end;
$$;

create or replace function public.join_elsewhere_workspace(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to an Elsewhere workspace.';
  end if;

  select id into target_workspace_id
  from public.workspaces
  where upper(join_code) = upper(trim(code));

  if target_workspace_id is null then
    raise exception 'That join code was not found.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace_id, auth.uid(), 'member');

  return target_workspace_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.possibilities enable row level security;
alter table public.reactions enable row level security;
alter table public.observations enable row level security;
alter table public.map_pins enable row level security;

-- Profiles: yourself or someone sharing your workspace.
drop policy if exists profiles_select_shared on public.profiles;
create policy profiles_select_shared on public.profiles
for select to authenticated
using (id = auth.uid() or public.shares_workspace(id));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Workspaces are visible to members. Direct inserts are intentionally omitted;
-- creation happens through create_elsewhere_workspace().
drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member on public.workspaces
for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists workspaces_update_owner on public.workspaces;
create policy workspaces_update_owner on public.workspaces
for update to authenticated
using (public.is_workspace_owner(id))
with check (public.is_workspace_owner(id));

-- Membership can be read by workspace members. Writes happen through RPCs.
drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member on public.workspace_members
for select to authenticated
using (public.is_workspace_member(workspace_id));

-- Possibilities: both members can collaborate fully inside their workspace.
drop policy if exists possibilities_select_member on public.possibilities;
create policy possibilities_select_member on public.possibilities
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists possibilities_insert_member on public.possibilities;
create policy possibilities_insert_member on public.possibilities
for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists possibilities_update_member on public.possibilities;
create policy possibilities_update_member on public.possibilities
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists possibilities_delete_member on public.possibilities;
create policy possibilities_delete_member on public.possibilities
for delete to authenticated
using (public.is_workspace_member(workspace_id));

-- Reactions: everyone in the workspace can see them; each person owns their own.
drop policy if exists reactions_select_member on public.reactions;
create policy reactions_select_member on public.reactions
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists reactions_insert_self on public.reactions;
create policy reactions_insert_self on public.reactions
for insert to authenticated
with check (
  public.is_workspace_member(workspace_id)
  and user_id = auth.uid()
  and exists (
    select 1 from public.possibilities p
    where p.id = reactions.possibility_id and p.workspace_id = reactions.workspace_id
  )
);

drop policy if exists reactions_update_self on public.reactions;
create policy reactions_update_self on public.reactions
for update to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid())
with check (
  public.is_workspace_member(workspace_id)
  and user_id = auth.uid()
  and exists (
    select 1 from public.possibilities p
    where p.id = reactions.possibility_id and p.workspace_id = reactions.workspace_id
  )
);

drop policy if exists reactions_delete_self on public.reactions;
create policy reactions_delete_self on public.reactions
for delete to authenticated
using (public.is_workspace_member(workspace_id) and user_id = auth.uid());

-- Observations: shared notebook; both members can curate it.
drop policy if exists observations_select_member on public.observations;
create policy observations_select_member on public.observations
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists observations_insert_member on public.observations;
create policy observations_insert_member on public.observations
for insert to authenticated
with check (public.is_workspace_member(workspace_id) and author_id = auth.uid());

drop policy if exists observations_update_member on public.observations;
create policy observations_update_member on public.observations
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists observations_delete_member on public.observations;
create policy observations_delete_member on public.observations
for delete to authenticated
using (public.is_workspace_member(workspace_id));

-- Map pins: shared pinboard; both members can collaborate inside the workspace.
drop policy if exists map_pins_select_member on public.map_pins;
create policy map_pins_select_member on public.map_pins
for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists map_pins_insert_member on public.map_pins;
create policy map_pins_insert_member on public.map_pins
for insert to authenticated
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists map_pins_update_member on public.map_pins;
create policy map_pins_update_member on public.map_pins
for update to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists map_pins_delete_member on public.map_pins;
create policy map_pins_delete_member on public.map_pins
for delete to authenticated
using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- Data API privileges
-- RLS remains the actual authorization boundary.
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update, delete on public.possibilities to authenticated;
grant select, insert, update, delete on public.reactions to authenticated;
grant select, insert, update, delete on public.observations to authenticated;
grant select, insert, update, delete on public.map_pins to authenticated;
grant execute on function public.create_elsewhere_workspace(text) to authenticated;
grant execute on function public.join_elsewhere_workspace(text) to authenticated;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.shares_workspace(uuid) to authenticated;

-- No anonymous table access is required for Elsewhere.
revoke all on public.profiles from anon;
revoke all on public.workspaces from anon;
revoke all on public.workspace_members from anon;
revoke all on public.possibilities from anon;
revoke all on public.reactions from anon;
revoke all on public.observations from anon;
revoke all on public.map_pins from anon;
