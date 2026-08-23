-- F-15 Car Compare, per-user saved comparisons.
--
-- Follows the credit_history / quotations pattern exactly: a profile_id FK that
-- cascades on delete, RLS enabled, and the FULL policy set. A select/insert-only
-- policy set (the mistake this table deliberately avoids) leaves a user able to
-- create rows they can never edit or delete, which is a POPIA problem as much as
-- a usability one, the product promises deletion of everything.

-- A CHECK constraint cannot contain a subquery, so distinctness is expressed
-- as an immutable helper. Keeping it in the database matters: a duplicated car
-- id would render a comparison column against itself.
create or replace function public.array_is_distinct(arr anyarray)
returns boolean
language sql
immutable
as $$
  select cardinality(arr) = cardinality(array(select distinct unnest(arr)));
$$;

create table if not exists public.saved_comparisons (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,

  -- The compared set. 2..3 members is the product rule (FR-15.02); the check
  -- constraint enforces it in the database so a bad client cannot store a
  -- single-car or six-car "comparison" that the UI then cannot render.
  car_ids uuid[] not null,

  -- Optional user label, e.g. "Polo vs Swift".
  name text check (name is null or char_length(name) <= 80),

  created_at timestamptz not null default now(),

  constraint saved_comparisons_size check (
    array_length(car_ids, 1) between 2 and 3
  ),
  constraint saved_comparisons_distinct check (public.array_is_distinct(car_ids))
);

create index if not exists saved_comparisons_profile_id_created_at_idx
  on public.saved_comparisons (profile_id, created_at desc);

comment on table public.saved_comparisons is
  'Per-user saved compare sets (2-3 vehicles). RLS scoped through auth.uid() = profile_id with the full select/insert/update/delete policy set.';

-- ---------------------------------------------------------------------------
-- Row Level Security, per-user data, all four verbs, scoped via auth.uid()
-- ---------------------------------------------------------------------------

alter table public.saved_comparisons enable row level security;

drop policy if exists "users read their own comparisons" on public.saved_comparisons;
create policy "users read their own comparisons"
  on public.saved_comparisons
  for select
  to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "users create their own comparisons" on public.saved_comparisons;
create policy "users create their own comparisons"
  on public.saved_comparisons
  for insert
  to authenticated
  with check (auth.uid() = profile_id);

drop policy if exists "users update their own comparisons" on public.saved_comparisons;
create policy "users update their own comparisons"
  on public.saved_comparisons
  for update
  to authenticated
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "users delete their own comparisons" on public.saved_comparisons;
create policy "users delete their own comparisons"
  on public.saved_comparisons
  for delete
  to authenticated
  using (auth.uid() = profile_id);
