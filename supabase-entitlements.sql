-- ============================================================
--  MUSIC ARCADE — entitlements (Pro subscription + one-time buys)
--  Run once in the Supabase SQL editor (after supabase-auth.sql).
--
--  The payment webhook (service role) is the ONLY writer.
--  Users can READ their own rows; they can never grant themselves.
-- ============================================================

create table if not exists public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product     text not null,                    -- 'pro' | 'course:learning-to-walk' | 'pack:xyz'
  kind        text not null default 'purchase', -- 'subscription' | 'purchase'
  status      text not null default 'active',   -- 'active' | 'canceled' | 'expired'
  period_end  timestamptz,                      -- subscriptions only; null = lifetime
  source      text,                             -- e.g. 'lemonsqueezy'
  ext_id      text,                             -- provider order / subscription id
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, product)                     -- one row per product per user (webhook upserts on this)
);

alter table public.entitlements enable row level security;

-- Owner can read their own entitlements. There are deliberately NO
-- insert/update/delete policies, so only the service-role webhook can write.
drop policy if exists "entitlements read own" on public.entitlements;
create policy "entitlements read own" on public.entitlements
  for select using (auth.uid() = user_id);

-- keep updated_at fresh (function may already exist from other migrations)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
--  TESTING (Phase 1): grant yourself Pro to see gating work,
--  before any payment integration exists. Replace the email.
-- ------------------------------------------------------------
-- insert into public.entitlements (user_id, product, kind, status)
-- select id, 'pro', 'subscription', 'active'
--   from auth.users where email = 'you@example.com'
-- on conflict (user_id, product) do update set status = 'active', kind = 'subscription';
--
-- Grant a single course instead:
-- insert into public.entitlements (user_id, product, kind, status)
-- select id, 'course:learning-to-walk', 'purchase', 'active'
--   from auth.users where email = 'you@example.com'
-- on conflict (user_id, product) do update set status = 'active';
--
-- Revoke (back to free):
-- delete from public.entitlements where product = 'pro'
--   and user_id = (select id from auth.users where email = 'you@example.com');
