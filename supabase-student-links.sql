-- ============================================================================
-- Music Arcade · Linking a Rollbook student to their player account
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Entirely optional, on both sides. A student with no account, or who doesn't
-- want to link, is unaffected — the Rollbook works exactly as before.
--
-- Consent model: the teacher can only ever create an INVITE. Nothing is shared
-- until the student signs in and enters the code themselves, and either side
-- can unlink at any time. A teacher cannot link a student by typing their name.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.student_links (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users on delete cascade,
  person_id   text not null,                 -- opaque id of the row in the teacher's rollbook
  code        text unique,                   -- the invite; cleared once claimed
  student_id  uuid references auth.users on delete cascade,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days'
);
create index if not exists student_links_teacher on public.student_links(teacher_id);
create index if not exists student_links_student on public.student_links(student_id);

alter table public.student_links enable row level security;

-- Both sides can see and end their own links. Nobody can browse the table:
-- an unclaimed invite is visible only to the teacher who made it, so codes
-- can't be harvested.
drop policy if exists "see own links" on public.student_links;
create policy "see own links" on public.student_links for select
  using (auth.uid() = teacher_id or auth.uid() = student_id);

drop policy if exists "end own links" on public.student_links;
create policy "end own links" on public.student_links for delete
  using (auth.uid() = teacher_id or auth.uid() = student_id);

-- No direct insert/update policy on purpose. Creating and claiming both go
-- through the functions below, so a client can never write a link for someone
-- else or claim one it hasn't been given the code for.

-- ---------------------------------------------------------------- teacher side
create or replace function public.create_student_link(p_person_id text)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  -- one live invite per student; making a new one retires the old
  delete from student_links
    where teacher_id = auth.uid() and person_id = p_person_id and claimed_at is null;
  -- 8 chars, no 0/O/1/I, so it can be read aloud or written on a page
  v_code := (select string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ',
              (floor(random()*32)+1)::int, 1), '') from generate_series(1,8));
  insert into student_links(teacher_id, person_id, code) values (auth.uid(), p_person_id, v_code);
  return v_code;
end; $$;
grant execute on function public.create_student_link(text) to authenticated;

-- ---------------------------------------------------------------- student side
create or replace function public.claim_student_link(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row student_links; v_teacher text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_row from student_links
    where code = upper(btrim(p_code)) and claimed_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'That code is not valid, or it has expired.'); end if;
  if v_row.teacher_id = auth.uid() then return jsonb_build_object('ok', false, 'error', 'That is your own invite code.'); end if;

  update student_links
     set student_id = auth.uid(), claimed_at = now(), code = null
   where id = v_row.id;

  select coalesce(username, 'your teacher') into v_teacher from profiles where id = v_row.teacher_id;
  return jsonb_build_object('ok', true, 'teacher', v_teacher);
end; $$;
grant execute on function public.claim_student_link(text) to authenticated;

-- Who a student is linked to, for their own account page.
create or replace function public.my_teachers()
returns table(link_id uuid, teacher text, since timestamptz)
language sql security definer set search_path = public as $$
  select l.id, coalesce(p.username,'your teacher'), l.claimed_at
    from student_links l left join profiles p on p.id = l.teacher_id
   where l.student_id = auth.uid() and l.claimed_at is not null
   order by l.claimed_at;
$$;
grant execute on function public.my_teachers() to authenticated;

-- ------------------------------------------------- what a linked teacher may read
-- Course progress only. Songs, charts, licks and everything else the student
-- saves stays private to them — this policy is scoped to kind = 'progress'.
-- Postgres ORs permissive policies together, so "read own creations" is untouched.
drop policy if exists "linked teacher reads progress" on public.creations;
create policy "linked teacher reads progress" on public.creations for select
  using (
    kind = 'progress'
    and exists (
      select 1 from public.student_links l
       where l.student_id = creations.user_id
         and l.teacher_id = auth.uid()
         and l.claimed_at is not null
    )
  );

-- Arcade high scores need nothing here: the scores table is the public
-- leaderboard already, looked up by username.
