-- ============================================================================
-- Music Arcade · Gallery "by {username}"  — run once in the SQL editor.
-- Attributes published songs to the signed-in maker (anonymous publishing still
-- works — those rows just have no author). Requires supabase-setup.sql (songs)
-- and supabase-auth.sql (profiles) already run.
-- ============================================================================

-- who published it (null = published anonymously / before accounts)
alter table public.songs add column if not exists user_id uuid references auth.users on delete set null;

-- Publish now records auth.uid() (the signed-in user, or null for anon).
create or replace function public.publish_song(p_title text, p_data jsonb)
returns table(id uuid, edit_token text)
language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_token text;
begin
  if p_data is null then raise exception 'no song data'; end if;
  v_token := encode(gen_random_bytes(16), 'hex');
  insert into public.songs(title, data, edit_token, user_id)
    values (left(coalesce(nullif(btrim(p_title),''),'Untitled'), 60), p_data, v_token, auth.uid())
    returning songs.id into v_id;
  return query select v_id, v_token;
end; $$;
grant execute on function public.publish_song(text, jsonb) to anon, authenticated;

-- Public read view now exposes the author's username (via the profiles join).
create or replace view public.songs_public as
  select s.id, s.created_at, s.title, s.data, s.votes, p.username as author
  from public.songs s
  left join public.profiles p on p.id = s.user_id;
grant select on public.songs_public to anon, authenticated;

-- Signed-in makers can remove their own posts without the edit token.
create or replace function public.delete_my_song(p_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.songs where id = p_id and user_id = auth.uid();
$$;
grant execute on function public.delete_my_song(uuid) to authenticated;
