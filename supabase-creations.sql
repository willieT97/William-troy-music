-- ============================================================================
-- Music Arcade · Creations (save & sync per-user)  — run once in the SQL editor
-- Stores each signed-in user's saved work (Jam Track charts, Song Lab songs, …).
-- Locked with Row Level Security so a user only ever sees/edits their own rows.
-- Requires supabase-auth.sql (accounts) to have been run first.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.creations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null,          -- 'jamtrack' | 'songlab' (extensible)
  title      text,
  data       jsonb not null,         -- the whole creation
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists creations_owner_kind on public.creations (user_id, kind, updated_at desc);

alter table public.creations enable row level security;

-- Owner-only access (auth.uid() is the signed-in user).
drop policy if exists "read own creations"   on public.creations;
drop policy if exists "insert own creations" on public.creations;
drop policy if exists "update own creations" on public.creations;
drop policy if exists "delete own creations" on public.creations;
create policy "read own creations"   on public.creations for select using (auth.uid() = user_id);
create policy "insert own creations" on public.creations for insert with check (auth.uid() = user_id);
create policy "update own creations" on public.creations for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own creations" on public.creations for delete using (auth.uid() = user_id);

-- keep updated_at fresh on every save
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists creations_touch on public.creations;
create trigger creations_touch before update on public.creations
  for each row execute function public.touch_updated_at();
