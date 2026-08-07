-- ============================================================================
-- Music Arcade · Accounts setup (Supabase Auth)
-- Run this ONCE in your Supabase project: SQL Editor → New query → paste → Run.
--
-- Dashboard steps to do alongside this (only you can do these — I can't log in):
--   1. Authentication → Providers → Email: turn ON "Email".
--        • For the easiest start, turn OFF "Confirm email" (people sign in
--          immediately). You can switch it back on later for extra security.
--   2. Authentication → URL Configuration → Site URL:
--        set it to your live site, e.g. https://williet97.github.io/William-troy-music/
--        (and add http://localhost:8000 under "Redirect URLs" for local testing).
--   3. Run the SQL below.
-- The anon/publishable key already in the site is safe in the browser — every
-- table here is locked with Row Level Security so people only touch their own row.
-- ============================================================================

-- One profile row per user (username shown around the site).
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone may read profiles (so usernames can show on shared songs / the gallery)…
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles for select using (true);

-- …but you can only create / change YOUR OWN row.
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- Auto-create the profile when someone signs up, copying the username they chose.
-- If that username is already taken, the account is still created (blank username,
-- which they can set later) — a taken name never blocks sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.profiles(id, username)
      values (new.id, nullif(btrim(new.raw_user_meta_data->>'username'), ''));
  exception when unique_violation then
    insert into public.profiles(id) values (new.id);
  end;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Check whether a username is free (used by the sign-up form before submitting).
create or replace function public.username_available(p_name text)
returns boolean language sql security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(btrim(p_name)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;
