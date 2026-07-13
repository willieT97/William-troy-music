-- Music Arcade — leaderboard table + access rules.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  game       text not null,
  initials   text not null,
  score      integer not null,
  created_at timestamptz not null default now()
);

-- keep reads fast when sorting a game's top scores
create index if not exists scores_game_score_idx on public.scores (game, score desc);

alter table public.scores enable row level security;

-- anyone may read the leaderboard
create policy "read scores" on public.scores
  for select using (true);

-- anyone may add a score, with light sanity checks
create policy "add scores" on public.scores
  for insert with check (
    char_length(initials) between 1 and 3
    and score >= 0 and score < 100000000
    and char_length(game) between 1 and 60
  );
