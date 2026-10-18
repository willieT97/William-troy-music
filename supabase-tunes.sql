-- ============================================================================
-- Music Arcade · Tunes added to the Melody Trainer library
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Anyone signed in can add a tune; whoever adds it chooses who sees it:
--   'private'   only them
--   'students'  them + the students linked to them (student_links)  — teachers only
--   'public'    everyone who uses the Melody Trainer, signed in or not — teachers only
-- The tune is stored as ABC (MusicXML is converted in the browser first).
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.added_tunes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  type        text not null default 'other',
  origin      text not null default 'Other',
  key         text not null default '',
  abc         text not null check (char_length(abc) between 10 and 60000),
  visibility  text not null default 'private' check (visibility in ('private','students','public')),
  created_at  timestamptz not null default now()
);
create index if not exists added_tunes_owner on public.added_tunes(owner_id);
create index if not exists added_tunes_public on public.added_tunes(visibility) where visibility = 'public';

alter table public.added_tunes enable row level security;

-- who may read: public tunes (anyone, even signed out), your own, and your
-- teacher's 'students' tunes once you've linked to them
drop policy if exists "read visible tunes" on public.added_tunes;
create policy "read visible tunes" on public.added_tunes for select
  using (
    visibility = 'public'
    or owner_id = auth.uid()
    or (visibility = 'students' and exists (
          select 1 from public.student_links l
           where l.teacher_id = added_tunes.owner_id
             and l.student_id = auth.uid()
             and l.claimed_at is not null))
  );

-- who may write: only your own rows; 'students' and 'public' need a teacher account
drop policy if exists "add own tunes" on public.added_tunes;
create policy "add own tunes" on public.added_tunes for insert
  with check (
    owner_id = auth.uid()
    and (visibility = 'private' or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
  );

drop policy if exists "change own tunes" on public.added_tunes;
create policy "change own tunes" on public.added_tunes for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (visibility = 'private' or exists (
          select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
  );

drop policy if exists "remove own tunes" on public.added_tunes;
create policy "remove own tunes" on public.added_tunes for delete
  using (owner_id = auth.uid());
