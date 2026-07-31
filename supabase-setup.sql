-- ============================================================================
-- Song Maker · Supabase setup
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- Then paste your Project URL + anon (publishable) key into composer.html:
--     var SB={ url:'https://YOURPROJECT.supabase.co', anonKey:'YOUR-ANON-KEY' };
-- No accounts / no personal data. Songs are shared by link only (add a public
-- gallery later by reading from songs_public). Anon never touches the table
-- directly — only the two functions below and a read-only view.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title      text,
  data       jsonb not null,          -- the whole song: {root,mode,tempo,snap,chords,notes}
  edit_token text not null,           -- secret returned once at publish; needed to unpublish
  votes      int not null default 0   -- upvotes, for the gallery chart
);
-- if the table already existed without the votes column:
alter table public.songs add column if not exists votes int not null default 0;

-- Lock the table down: RLS on, and no direct grants to anonymous users.
alter table public.songs enable row level security;
revoke all on public.songs from anon, authenticated;

-- Public, read-only view WITHOUT the secret edit_token (shared links + the gallery).
create or replace view public.songs_public as
  select id, created_at, title, data, votes from public.songs;
grant select on public.songs_public to anon;

-- Upvote a song (returns the new count). Client de-dupes one vote per browser.
create or replace function public.vote_song(p_id uuid)
returns int language sql security definer set search_path = public as $$
  update public.songs set votes = votes + 1 where id = p_id returning votes;
$$;
grant execute on function public.vote_song(uuid) to anon;

-- Publish: inserts a song, makes the secret token server-side, returns id + token.
-- search_path includes `extensions` so pgcrypto's gen_random_bytes/gen_random_uuid resolve
-- (Supabase installs extensions in the `extensions` schema, not `public`).
create or replace function public.publish_song(p_title text, p_data jsonb)
returns table(id uuid, edit_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_token text;
begin
  if p_data is null then raise exception 'no song data'; end if;
  v_token := encode(gen_random_bytes(16), 'hex');
  insert into public.songs(title, data, edit_token)
    values (left(coalesce(nullif(btrim(p_title),''),'Untitled'), 60), p_data, v_token)
    returning songs.id into v_id;
  return query select v_id, v_token;
end; $$;
grant execute on function public.publish_song(text, jsonb) to anon;

-- Unpublish: deletes only if the caller has the matching secret token.
create or replace function public.delete_song(p_id uuid, p_token text)
returns void
language sql security definer set search_path = public as $$
  delete from public.songs where id = p_id and edit_token = p_token;
$$;
grant execute on function public.delete_song(uuid, text) to anon;

-- ----------------------------------------------------------------------------
-- Notes / hardening ideas for later:
--   • Rate-limit publishing (e.g. a per-IP counter, or Supabase Edge Function)
--     to keep bots from spamming.
--   • Add a simple profanity filter on p_title inside publish_song.
--   • For a public gallery: select id,title,created_at from public.songs_public
--     order by created_at desc — and add a report/hide flag + moderation.
-- ----------------------------------------------------------------------------
