-- F-15 Car Compare, engine & specification data for the vehicle catalogue.
--
-- The cars table carries only title/brand/year/mileage/price/fuel/transmission
-- (PRD §18.3). A comparison screen needs more than that, so the specs live in a
-- linked table rather than being widened onto cars: specs arrive from a different
-- source, on a different cadence, and most listings will not have them.
--
-- Every value column is NULLABLE BY DESIGN. A missing spec is stored as NULL and
-- rendered "Not listed" in the interface. It is never defaulted to 0, and never
-- filled with a segment average, a plausible-looking guess in a comparison table
-- is indistinguishable from a lie to the person reading it.

create table if not exists public.car_specs (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null references public.cars (id) on delete cascade,

  -- Drivetrain
  engine_cc integer check (engine_cc is null or engine_cc between 400 and 8000),
  power_kw numeric(6, 1) check (power_kw is null or power_kw between 10 and 1500),
  torque_nm numeric(7, 1) check (torque_nm is null or torque_nm between 20 and 2000),
  drivetrain text check (drivetrain is null or drivetrain in ('FWD', 'RWD', 'AWD', '4x4')),

  -- Practicality
  seats smallint check (seats is null or seats between 1 and 23),
  boot_litres integer check (boot_litres is null or boot_litres between 0 and 5000),

  -- Consumption. Manufacturer-claimed figures only, never a derived estimate:
  -- the running-cost calculator uses an explicit user-editable assumption when
  -- this is NULL, and says so in the interface.
  combined_l_per_100km numeric(4, 1)
    check (combined_l_per_100km is null or combined_l_per_100km between 1 and 40),

  -- Safety. Global NCAP / Euro NCAP star rating as published by that body.
  ncap_stars smallint check (ncap_stars is null or ncap_stars between 0 and 5),
  ncap_programme text check (ncap_programme is null or ncap_programme in ('Global NCAP', 'Euro NCAP', 'ANCAP')),
  ncap_year smallint check (ncap_year is null or ncap_year between 1997 and 2100),

  -- Provenance. A spec row that carries any value must name where it came from.
  -- This is the schema-level form of "every number is sourced or labelled".
  source text,
  source_url text,
  captured_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint car_specs_car_id_key unique (car_id),

  constraint car_specs_requires_source check (
    (
      engine_cc is null and power_kw is null and torque_nm is null
      and drivetrain is null and seats is null and boot_litres is null
      and combined_l_per_100km is null and ncap_stars is null
    )
    or (source is not null and source_url is not null and captured_at is not null)
  )
);

create index if not exists car_specs_car_id_idx on public.car_specs (car_id);

comment on table public.car_specs is
  'Per-vehicle specification data. All value columns nullable; NULL renders as "Not listed". Any row carrying a value must cite source, source_url and captured_at (car_specs_requires_source).';

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Shared catalogue data, not user data: every authenticated user may read it,
-- and only the service role may write it. Scoping reads through auth.uid()
-- here would be cargo-culting the per-user pattern onto a public catalogue.
-- ---------------------------------------------------------------------------

alter table public.car_specs enable row level security;

drop policy if exists "car_specs are readable by authenticated users" on public.car_specs;
create policy "car_specs are readable by authenticated users"
  on public.car_specs
  for select
  to authenticated
  using (true);

-- Writes are deliberately not granted to authenticated or anon. The ingestion
-- job runs as the service role, which bypasses RLS. No client-side write path
-- exists, so no insert/update/delete policy is defined for end users.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists car_specs_set_updated_at on public.car_specs;
create trigger car_specs_set_updated_at
  before update on public.car_specs
  for each row
  execute function public.set_updated_at();
