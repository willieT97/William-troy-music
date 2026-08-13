-- ============================================================================
-- Music Arcade · Account roles (player / teacher)
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run.
--
-- Everyone who already has an account becomes a 'player'. Teachers get the
-- Rollbook tab in the site nav; nothing else changes for anyone.
-- ============================================================================

-- 1. the column ---------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'player';

-- constraint added separately so a re-run doesn't error
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('player','teacher'));
  end if;
end $$;

-- 2. copy the choice made on the sign-up form ---------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  chosen text := lower(btrim(coalesce(new.raw_user_meta_data->>'role', 'player')));
begin
  if chosen not in ('player','teacher') then chosen := 'player'; end if;
  begin
    insert into public.profiles(id, username, role)
      values (new.id, nullif(btrim(new.raw_user_meta_data->>'username'), ''), chosen);
  exception when unique_violation then          -- username taken: keep the account
    insert into public.profiles(id, role) values (new.id, chosen);
  end;
  return new;
end; $$;

-- 3. you can change your own role later (Account → I teach / I'm learning) ----
-- The existing "update own profile" policy already covers this: it allows a
-- signed-in user to update their own row and nobody else's. Nothing to add.

-- ---------------------------------------------------------------------------
-- Make yourself a teacher right now (or just use the button in Your account):
--
--   update public.profiles set role = 'teacher'
--   where id = (select id from auth.users where email = 'williamtroy1997@gmail.com');
-- ---------------------------------------------------------------------------
