-- F-15 Car Compare, asking-price history for the price sparkline.
--
-- One row per observation of a listing's asking price. The sparkline renders
-- only where at least two observations exist inside the window; with no rows,
-- no line is drawn. A flat placeholder would assert price stability we have not
-- observed.

create table if not exists public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,

  price integer not null check (price > 0),
  observed_at timestamptz not null default now(),

  -- Where the observation came from, so a chart can always be traced back.
  source text not null,

  constraint price_snapshots_unique_observation unique (car_id, observed_at)
);

create index if not exists price_snapshots_car_id_observed_at_idx
  on public.price_snapshots (car_id, observed_at desc);

comment on table public.price_snapshots is
  'Observed asking prices over time. The UI draws a sparkline only from >= 2 real observations inside the window; absence renders no chart at all.';

-- ---------------------------------------------------------------------------
-- Row Level Security, catalogue data: readable by any signed-in user, written
-- only by the ingestion job running as the service role.
-- ---------------------------------------------------------------------------

alter table public.price_snapshots enable row level security;

drop policy if exists "price snapshots are readable by authenticated users" on public.price_snapshots;
create policy "price snapshots are readable by authenticated users"
  on public.price_snapshots
  for select
  to authenticated
  using (true);
