-- Visit analytics for the super-admin dashboard.
--
-- WHAT IS RECORDED, AND WHAT IS DELIBERATELY NOT
--
-- Recorded: the path, a coarse device class, whether the visitor was signed in,
-- a rotating session token, and the timestamp.
--
-- NOT recorded: no IP address, no user agent string, no user id, no referrer
-- query string, no location. The whole point of this app is that it does not
-- collect what it does not need, and a first-time buyer's browsing history is
-- exactly the sort of thing a dealership would love and has no right to.
--
-- The session token is generated in the browser, rotates every 24 hours, and is
-- stored hashed. It exists only so "visits" and "unique visitors" can be told
-- apart. It cannot be traced back to a person, and after 24 hours it cannot be
-- linked to the previous day's activity either.

create table if not exists public.app_visits (
  id uuid primary key default gen_random_uuid(),
  -- The in-app route. Constrained so this cannot become a free-text sink for
  -- whatever a client feels like posting.
  path text not null check (char_length(path) between 1 and 120),
  -- 'phone' | 'tablet' | 'desktop'. Derived in the browser from viewport width.
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  -- Whether the visitor had a session. Never WHICH session.
  signed_in boolean not null default false,
  -- sha-256 of a rotating client token. Not reversible, not stable past 24h.
  session_hash text not null check (char_length(session_hash) = 64),
  visited_at timestamptz not null default now()
);

create index if not exists app_visits_visited_at_idx on public.app_visits (visited_at desc);
create index if not exists app_visits_path_idx on public.app_visits (path);

alter table public.app_visits enable row level security;

-- No policies at all: every client role is refused. Writes happen through the
-- server route with the service role, which bypasses RLS, and reads happen
-- through the analytics route. There is deliberately no path by which a browser
-- can read this table or write a row directly.
revoke all on public.app_visits from anon, authenticated;

/* ------------------------------------------------------------ aggregates -- */

-- Aggregation runs in the database rather than by pulling rows into Node. Two
-- reasons: the row count grows without bound, and an aggregate cannot leak an
-- individual visit even if the function is called by mistake.

create or replace function public.visit_daily(days integer default 30)
returns table (day date, visits bigint, visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    d::date as day,
    count(v.id) as visits,
    count(distinct v.session_hash) as visitors
  from generate_series(
         (current_date - (greatest(least(days, 365), 1) - 1)),
         current_date,
         interval '1 day'
       ) as d
  left join public.app_visits v
    on v.visited_at >= d
   and v.visited_at < d + interval '1 day'
  group by d
  order by d;
$$;

create or replace function public.visit_summary()
returns table (
  total_visits bigint,
  total_visitors bigint,
  visits_today bigint,
  visitors_today bigint,
  visits_7d bigint,
  visitors_7d bigint,
  signed_in_share numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(distinct session_hash)::bigint,
    count(*) filter (where visited_at >= current_date)::bigint,
    count(distinct session_hash) filter (where visited_at >= current_date)::bigint,
    count(*) filter (where visited_at >= current_date - 6)::bigint,
    count(distinct session_hash) filter (where visited_at >= current_date - 6)::bigint,
    -- Null rather than 0 when there is nothing to divide: an empty table is
    -- "no data", not "0% signed in", and the dashboard must show the difference.
    case when count(*) = 0 then null
         else round((count(*) filter (where signed_in))::numeric * 100 / count(*), 1)
    end
  from public.app_visits;
$$;

create or replace function public.visit_top_paths(limit_count integer default 8)
returns table (path text, visits bigint, visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.path, count(*)::bigint, count(distinct v.session_hash)::bigint
  from public.app_visits v
  group by v.path
  order by count(*) desc
  limit greatest(least(limit_count, 50), 1);
$$;

create or replace function public.visit_devices()
returns table (device text, visits bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.device, count(*)::bigint
  from public.app_visits v
  group by v.device
  order by count(*) desc;
$$;

-- These are security definer, so execute is revoked from client roles and
-- granted only to the service role the analytics route runs as.
revoke execute on function public.visit_daily(integer) from public, anon, authenticated;
revoke execute on function public.visit_summary() from public, anon, authenticated;
revoke execute on function public.visit_top_paths(integer) from public, anon, authenticated;
revoke execute on function public.visit_devices() from public, anon, authenticated;

grant execute on function public.visit_daily(integer) to service_role;
grant execute on function public.visit_summary() to service_role;
grant execute on function public.visit_top_paths(integer) to service_role;
grant execute on function public.visit_devices() to service_role;
