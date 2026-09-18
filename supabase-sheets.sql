-- ============================================================================
-- Music Arcade · Private song sheets a teacher shares with linked students
-- Run this ONCE in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- Depends on supabase-student-links.sql (the student_links table + consent model).
--
-- What it sets up:
--   • a PRIVATE storage bucket 'sheets' (PDFs + images, 25 MB cap) — never public
--   • public.sheets, one row per uploaded sheet, recording who it's shared with
--   • row-level rules so a sheet (and its file) is readable ONLY by the teacher
--     who owns it and the linked students it's been shared with. Nothing here is
--     ever public or cross-teacher.
--
-- Sharing model, per sheet:
--   scope = 'assigned'  → visible only to the students in `assigned` (rollbook
--                         person ids, matched to a claimed student_links row)
--   scope = 'library'   → visible to ALL of that teacher's linked students
-- ============================================================================

-- ---- the private bucket ----------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sheets', 'sheets', false, 26214400,
        array['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- metadata --------------------------------------------------------------
create table if not exists public.sheets (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references auth.users on delete cascade,
  title       text not null,
  path        text not null unique,          -- storage object name: {teacher_id}/{id}.ext
  mime        text,
  size        bigint,
  scope       text not null default 'assigned' check (scope in ('assigned','library')),
  assigned    text[] not null default '{}',  -- rollbook person ids, when scope='assigned'
  created_at  timestamptz not null default now()
);
create index if not exists sheets_teacher on public.sheets(teacher_id);

alter table public.sheets enable row level security;

-- teacher: full control of their own sheet rows
drop policy if exists "teacher manages own sheets" on public.sheets;
create policy "teacher manages own sheets" on public.sheets for all
  using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

-- student: read a sheet shared with them (library, or assigned to their person id)
drop policy if exists "student reads shared sheets" on public.sheets;
create policy "student reads shared sheets" on public.sheets for select
  using (exists (
    select 1 from public.student_links l
     where l.teacher_id = sheets.teacher_id
       and l.student_id = auth.uid()
       and l.claimed_at is not null
       and (sheets.scope = 'library' or l.person_id = any (sheets.assigned))
  ));

-- ---- the files themselves (storage.objects, bucket 'sheets') ---------------
-- teacher: may only touch files inside their own {uid}/ folder
drop policy if exists "teacher writes own sheet files" on storage.objects;
create policy "teacher writes own sheet files" on storage.objects for insert
  with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "teacher updates own sheet files" on storage.objects;
create policy "teacher updates own sheet files" on storage.objects for update
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "teacher deletes own sheet files" on storage.objects;
create policy "teacher deletes own sheet files" on storage.objects for delete
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);

-- read a file: the owning teacher, or a linked student the sheet is shared with
drop policy if exists "read sheet files" on storage.objects;
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
           and (sh.scope = 'library' or l.person_id = any (sh.assigned))
      )
    )
  );
