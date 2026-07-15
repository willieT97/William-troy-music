-- Music Arcade — allow full names on the leaderboard.
-- Run this ONCE if you already created the table with the old 3-char limit.
-- Supabase → SQL Editor → New query → paste → Run.

drop policy if exists "add scores" on public.scores;

create policy "add scores" on public.scores
  for insert with check (
    char_length(initials) between 1 and 24
    and score >= 0 and score < 100000000
    and char_length(game) between 1 and 60
  );
