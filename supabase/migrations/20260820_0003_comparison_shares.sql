-- F-15 Car Compare, read-only "ask a friend" share links.
--
-- The privacy shape matters more than the feature: a share link exposes the
-- CARS and nothing about the person. There is deliberately no column here for
-- an instalment, a credit band or an income, so a future careless join cannot
-- leak one, the table cannot hold what it has no column for.

create table if not exists public.comparison_shares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- Opaque, unguessable, URL-safe. Not derived from the user id.
  token text not null unique check (char_length(token) between 16 and 64),

  car_ids uuid[] not null,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null,

  constraint comparison_shares_size check (array_length(car_ids, 1) between 2 and 3),
  constraint comparison_shares_ttl check (expires_at > created_at)
);

create index if not exists comparison_shares_token_idx on public.comparison_shares (token);
create index if not exists comparison_shares_profile_id_idx on public.comparison_shares (profile_id, created_at desc);

comment on table public.comparison_shares is
  '24-hour read-only share links for a comparison. Holds car ids only, never instalment, credit band or income.';

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Two distinct audiences:
--   * the owner: full CRUD over their own share links, via auth.uid();
--   * a visitor: may read ONE row, and only by presenting an unexpired token.
--
-- The anon select policy is intentionally narrow: it cannot enumerate. Without
-- a token the predicate is false, so `select * from comparison_shares` as anon
-- returns nothing.
-- ---------------------------------------------------------------------------

alter table public.comparison_shares enable row level security;

drop policy if exists "owners read their own shares" on public.comparison_shares;
create policy "owners read their own shares"
  on public.comparison_shares
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "owners create their own shares" on public.comparison_shares;
create policy "owners create their own shares"
  on public.comparison_shares
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "owners update their own shares" on public.comparison_shares;
create policy "owners update their own shares"
  on public.comparison_shares
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "owners delete their own shares" on public.comparison_shares;
create policy "owners delete their own shares"
  on public.comparison_shares
  for delete
  to authenticated
  using (auth.uid() = profile_id);

-- Token-scoped public read. The token arrives as a request-local setting rather
-- than a URL-visible filter, so the policy cannot be satisfied by guessing a
-- profile id.
drop policy if exists "visitors read an unexpired share by token" on public.comparison_shares;
create policy "visitors read an unexpired share by token"
  on public.comparison_shares
  for select
  to anon
  using (
    expires_at > now()
    and token = nullif(current_setting('request.share_token', true), '')
  );

-- Housekeeping: expired links are deleted, not merely hidden.
create or replace function public.purge_expired_comparison_shares()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.comparison_shares where expires_at <= now();
$$;
