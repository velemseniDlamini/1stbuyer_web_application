-- Brand-new car catalogue.
--
-- Separate from public.cars because these are model listings from a price list,
-- not individual used units: there is no mileage, no dealer branch and no
-- specific vehicle behind them.
--
-- PROVENANCE IS NOT OPTIONAL. source_name, source_url and source_published_at
-- are NOT NULL. A row cannot exist without naming where its price came from
-- and when that price was published, because a car price without a date is a
-- claim we cannot stand behind three months later.

create table if not exists public.new_cars (
  id text primary key,

  make text not null,
  model text not null,
  variant text not null,
  body_type text not null check (body_type in ('Hatchback', 'Sedan', 'Crossover', 'MPV')),

  list_price integer not null check (list_price > 0),
  fuel text not null check (fuel in ('Petrol', 'Diesel', 'Hybrid', 'Electric')),
  transmission text check (transmission is null or transmission in ('Manual', 'Automatic')),

  -- Every specification column is nullable on purpose: a source that did not
  -- state a figure leaves it null and the interface renders "Not listed".
  engine_cc integer check (engine_cc is null or engine_cc between 400 and 8000),
  cylinders smallint check (cylinders is null or cylinders between 2 and 16),
  power_kw numeric(6, 1) check (power_kw is null or power_kw between 10 and 1500),
  torque_nm numeric(7, 1) check (torque_nm is null or torque_nm between 20 and 2000),
  consumption_l100km numeric(4, 1) check (consumption_l100km is null or consumption_l100km between 1 and 40),
  tank_litres integer check (tank_litres is null or tank_litres between 10 and 200),
  seats smallint check (seats is null or seats between 1 and 23),
  boot_litres integer check (boot_litres is null or boot_litres between 0 and 5000),
  ncap_stars smallint check (ncap_stars is null or ncap_stars between 0 and 5),
  ncap_programme text,

  -- Null unless this repository actually holds a photograph of this model. A
  -- stand-in image of a different car would misrepresent what is being priced.
  image_url text,

  source_name text not null,
  source_title text not null,
  source_url text not null check (source_url like 'https://%'),
  source_published_at date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists new_cars_price_idx on public.new_cars (list_price);
create index if not exists new_cars_make_idx on public.new_cars (make, model);

comment on table public.new_cars is
  'New-vehicle price list rows. Every row cites publisher, URL and publication date; the app displays the date next to the price and flags anything older than 90 days.';

alter table public.new_cars enable row level security;

-- Catalogue data: readable by any signed-in user, written only by the ingestion
-- running as the service role. No client write path exists.
drop policy if exists "new_cars: signed-in read" on public.new_cars;
create policy "new_cars: signed-in read"
  on public.new_cars for select to authenticated using (true);

drop trigger if exists new_cars_touch_updated_at on public.new_cars;
create trigger new_cars_touch_updated_at
  before update on public.new_cars
  for each row execute function public.touch_updated_at();
