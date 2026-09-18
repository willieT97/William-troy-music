-- ============================================================================
-- Music Arcade · Private song sheets a teacher shares with linked students
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run. Safe to re-run
-- (it upgrades an earlier version of this file in place).
--
-- Depends on supabase-student-links.sql (the student_links table + consent model).
--
-- Model:
--   • Every sheet a teacher uploads lives in their LIBRARY (private bucket 'sheets').
--   • A student is either given FULL library access (sees everything) — set per
--     student on their link row — or sees only the individual sheets the teacher
--     ASSIGNS to them (sheets.assigned holds those students' rollbook person ids).
--   • Nothing is ever public or cross-teacher; all of it is enforced by RLS.
-- ============================================================================

-- ---- the private bucket ----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sheets', 'sheets', false, 26214400,
        array['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- metadata (the library) ------------------------------------------------
create table if not exists public.sheets (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users on delete cascade,
  title       text not null,
  path        text not null unique,          -- storage object name: {teacher_id}/{id}.ext
  mime        text,
  size        bigint,
  assigned    text[] not null default '{}',  -- rollbook person ids this sheet is assigned to
  chords      text[] not null default '{}',  -- chords the song uses, e.g. {G,C,D,Em} — for filtering
  created_at  timestamptz not null default now()
);
create index if not exists sheets_teacher on public.sheets(teacher_id);
alter table public.sheets add column if not exists chords text[] not null default '{}';  -- for upgrades
alter table public.sheets enable row level security;

-- Upgrade from the earlier per-sheet 'scope' model: drop the policies that used
-- it, then the column. (Access is per-student now, below.)
drop policy if exists "student reads shared sheets" on public.sheets;
drop policy if exists "read sheet files" on storage.objects;
alter table public.sheets drop column if exists scope;

-- per-student full-library access lives on the link row
alter table public.student_links add column if not exists library_access boolean not null default false;

-- ---- who can read a sheet row ---------------------------------------------
-- teacher: full control of their own sheets
drop policy if exists "teacher manages own sheets" on public.sheets;
create policy "teacher manages own sheets" on public.sheets for all
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

-- student: a sheet assigned to them, or any sheet if they have full library access
create policy "student reads shared sheets" on public.sheets for select
  using (exists (
    select 1 from public.student_links l
     where l.teacher_id = sheets.teacher_id
       and l.student_id = auth.uid()
       and l.claimed_at is not null
       and (l.person_id = any (sheets.assigned) or l.library_access)
  ));

-- ---- who can read the files themselves (storage.objects, bucket 'sheets') --
-- teacher: only files inside their own {uid}/ folder
drop policy if exists "teacher writes own sheet files" on storage.objects;
create policy "teacher writes own sheet files" on storage.objects for insert
  with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "teacher updates own sheet files" on storage.objects;
create policy "teacher updates own sheet files" on storage.objects for update
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "teacher deletes own sheet files" on storage.objects;
create policy "teacher deletes own sheet files" on storage.objects for delete
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);

-- read a file: the owning teacher, or a linked student a sheet is shared with
create policy "read sheet files" on storage.objects for select
  using (
    bucket_id = 'sheets' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
          from public.sheets sh
          join public.student_links l
            on l.teacher_id = sh.teacher_id
           and l.student_id = auth.uid()
           and l.claimed_at is not null
         where sh.path = storage.objects.name
           and (l.person_id = any (sh.assigned) or l.library_access)
      )
    )
  );

-- ---- teacher grants / revokes a student's full library access --------------
create or replace function public.set_library_access(p_person_id text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update student_links set library_access = coalesce(p_on, false)
   where teacher_id = auth.uid() and person_id = p_person_id;
  return coalesce(p_on, false);
end; $$;
grant execute on function public.set_library_access(text, boolean) to authenticated;
