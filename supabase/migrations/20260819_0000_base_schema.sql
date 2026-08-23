-- Base schema.
--
-- Written when the migrations were first applied to a live project and the
-- database turned out to be empty. Migrations 0001-0005 reference
-- public.profiles and public.cars, so those tables and the per-user tables the
-- app already models are created here first.
--
-- Two rules hold throughout, matching the product:
--   1. Every per-user table has RLS with the full select/insert/update/delete
--      policy set scoped through auth.uid().
--   2. Catalogue data is readable by any signed-in user and writable only by
--      the service role, because it belongs to nobody.

/* -------------------------------------------------------------- profiles -- */

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  email text not null,
  full_name text,
  city text,
  province text,
  -- Derived so the support directory view and the app cannot disagree.
  location text generated always as (
    nullif(btrim(coalesce(city, '') || ', ' || coalesce(province, ''), ' ,'), '')
  ) stored,

  employment text,
  buying_goal text,
  date_of_birth date,
  licence_issued date,

  -- Sensitive. Deliberately NOT part of the support directory view (0005).
  monthly_income numeric(12, 2) check (monthly_income is null or monthly_income >= 0),
  credit_score integer check (credit_score is null or credit_score between 0 and 999),
  id_number text,

  credit_bureau text not null default 'Not connected',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.credit_score is
  'Self-reported bureau score. Never exposed to support staff: see the buyer_directory view in the staff migration.';

alter table public.profiles enable row level security;

drop policy if exists "profiles: owner reads" on public.profiles;
create policy "profiles: owner reads" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles: owner inserts" on public.profiles;
create policy "profiles: owner inserts" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles: owner updates" on public.profiles;
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles: owner deletes" on public.profiles;
create policy "profiles: owner deletes" on public.profiles
  for delete to authenticated using (auth.uid() = id);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A profile row appears the moment an auth user is created, so the app never
-- has a signed-in user with no row to write to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

/* --------------------------------------------------------------- dealers -- */

create table if not exists public.dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  city text not null,
  province text not null,
  brands text[] not null default '{}',
  website text,
  created_at timestamptz not null default now()
);

comment on table public.dealers is
  'Branch facts only: location and brands. No ratings, review counts or compliance badges, because none of that is verifiable here.';

alter table public.dealers enable row level security;

drop policy if exists "dealers: signed-in read" on public.dealers;
create policy "dealers: signed-in read" on public.dealers
  for select to authenticated using (true);

/* ------------------------------------------------------------------ cars -- */

create table if not exists public.cars (
  id uuid primary key default gen_random_uuid(),
  make text not null,
  model text not null,
  variant text,
  year smallint not null check (year between 1950 and 2100),
  price integer not null check (price > 0),
  mileage integer not null check (mileage >= 0),
  fuel text not null check (fuel in ('Petrol', 'Diesel', 'Hybrid', 'Electric')),
  transmission text not null check (transmission in ('Manual', 'Automatic')),
  city text,
  province text,
  dealer_id uuid references public.dealers (id) on delete set null,
  image_url text,

  -- Market value is set equal to the asking price rather than inventing a
  -- discount. The comparison screen treats a NULL here as "no market context",
  -- which is the honest default until a valuation feed is licensed.
  market_value integer check (market_value is null or market_value > 0),

  is_sample boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cars_make_model_year_idx on public.cars (make, model, year);
create index if not exists cars_price_idx on public.cars (price);

alter table public.cars enable row level security;

drop policy if exists "cars: signed-in read" on public.cars;
create policy "cars: signed-in read" on public.cars
  for select to authenticated using (true);

drop trigger if exists cars_touch_updated_at on public.cars;
create trigger cars_touch_updated_at
  before update on public.cars
  for each row execute function public.touch_updated_at();

/* -------------------------------------------------------- credit history -- */

create table if not exists public.credit_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  score integer not null check (score between 0 and 999),
  bureau text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists credit_history_profile_idx
  on public.credit_history (profile_id, recorded_at desc);

alter table public.credit_history enable row level security;

drop policy if exists "credit_history: owner reads" on public.credit_history;
create policy "credit_history: owner reads" on public.credit_history
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "credit_history: owner inserts" on public.credit_history;
create policy "credit_history: owner inserts" on public.credit_history
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "credit_history: owner updates" on public.credit_history;
create policy "credit_history: owner updates" on public.credit_history
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "credit_history: owner deletes" on public.credit_history;
create policy "credit_history: owner deletes" on public.credit_history
  for delete to authenticated using (auth.uid() = profile_id);

/* ------------------------------------------------------ finance scenarios -- */

create table if not exists public.finance_scenarios (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists finance_scenarios_profile_idx
  on public.finance_scenarios (profile_id, created_at desc);

alter table public.finance_scenarios enable row level security;

drop policy if exists "finance_scenarios: owner reads" on public.finance_scenarios;
create policy "finance_scenarios: owner reads" on public.finance_scenarios
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "finance_scenarios: owner inserts" on public.finance_scenarios;
create policy "finance_scenarios: owner inserts" on public.finance_scenarios
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "finance_scenarios: owner updates" on public.finance_scenarios;
create policy "finance_scenarios: owner updates" on public.finance_scenarios
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "finance_scenarios: owner deletes" on public.finance_scenarios;
create policy "finance_scenarios: owner deletes" on public.finance_scenarios
  for delete to authenticated using (auth.uid() = profile_id);

/* ------------------------------------------------------------ quotations -- */

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  vehicle text not null,
  findings jsonb not null,
  fairness_score smallint not null check (fairness_score between 0 and 100),
  created_at timestamptz not null default now()
);

create index if not exists quotations_profile_idx on public.quotations (profile_id, created_at desc);

alter table public.quotations enable row level security;

drop policy if exists "quotations: owner reads" on public.quotations;
create policy "quotations: owner reads" on public.quotations
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "quotations: owner inserts" on public.quotations;
create policy "quotations: owner inserts" on public.quotations
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "quotations: owner updates" on public.quotations;
create policy "quotations: owner updates" on public.quotations
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "quotations: owner deletes" on public.quotations;
create policy "quotations: owner deletes" on public.quotations
  for delete to authenticated using (auth.uid() = profile_id);

/* ------------------------------------------------------------- documents -- */

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  -- Matches the pack item ids in lib/documents.ts.
  doc_key text not null,
  file_name text not null,
  -- Date printed on the document, used for the currency rules.
  doc_date date,
  status text not null default 'added' check (status in ('missing', 'added')),
  created_at timestamptz not null default now(),
  unique (profile_id, doc_key)
);

alter table public.documents enable row level security;

drop policy if exists "documents: owner reads" on public.documents;
create policy "documents: owner reads" on public.documents
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "documents: owner inserts" on public.documents;
create policy "documents: owner inserts" on public.documents
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "documents: owner updates" on public.documents;
create policy "documents: owner updates" on public.documents
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "documents: owner deletes" on public.documents;
create policy "documents: owner deletes" on public.documents
  for delete to authenticated using (auth.uid() = profile_id);

/* --------------------------------------------------------- saved vehicles -- */

create table if not exists public.saved_vehicles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  car_id uuid not null references public.cars (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, car_id)
);

alter table public.saved_vehicles enable row level security;

drop policy if exists "saved_vehicles: owner reads" on public.saved_vehicles;
create policy "saved_vehicles: owner reads" on public.saved_vehicles
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "saved_vehicles: owner inserts" on public.saved_vehicles;
create policy "saved_vehicles: owner inserts" on public.saved_vehicles
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "saved_vehicles: owner updates" on public.saved_vehicles;
create policy "saved_vehicles: owner updates" on public.saved_vehicles
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "saved_vehicles: owner deletes" on public.saved_vehicles;
create policy "saved_vehicles: owner deletes" on public.saved_vehicles
  for delete to authenticated using (auth.uid() = profile_id);

/* ----------------------------------------------------------- notifications -- */

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_profile_idx
  on public.notifications (profile_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: owner reads" on public.notifications;
create policy "notifications: owner reads" on public.notifications
  for select to authenticated using (auth.uid() = profile_id);

drop policy if exists "notifications: owner inserts" on public.notifications;
create policy "notifications: owner inserts" on public.notifications
  for insert to authenticated with check (auth.uid() = profile_id);

drop policy if exists "notifications: owner updates" on public.notifications;
create policy "notifications: owner updates" on public.notifications
  for update to authenticated using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists "notifications: owner deletes" on public.notifications;
create policy "notifications: owner deletes" on public.notifications
  for delete to authenticated using (auth.uid() = profile_id);
