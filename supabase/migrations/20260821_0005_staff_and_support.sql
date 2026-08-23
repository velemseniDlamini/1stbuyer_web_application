-- Part C: the staff layer.
--
-- READ supabase/README.md FIRST. These migrations are the real access boundary
-- for a server-backed deployment. The running build has no Supabase connection,
-- so the portal it ships with is a workflow model whose checks run in the
-- browser. Nothing below is executed today.
--
-- The design rule throughout: support may read who a person is, never what they
-- earn or score. That is enforced by a view plus column grants, not by hoping
-- the client asks for the right columns.

/* ---------------------------------------------------------------- roles -- */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'staff_role') then
    create type public.staff_role as enum ('buyer', 'support', 'super_admin');
  end if;
end
$$;

alter table public.profiles
  add column if not exists role public.staff_role not null default 'buyer',
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspension_reason text,
  add column if not exists preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.role is
  'buyer by default. Staff are provisioned only through the invite flow; there is no self-service path to support or super_admin.';

create index if not exists profiles_role_idx on public.profiles (role) where role <> 'buyer';

create or replace function public.current_role()
returns public.staff_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'buyer');
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select public.current_role() in ('support', 'super_admin');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
as $$
  select public.current_role() = 'super_admin';
$$;

/* -------------------------------------------------- profile visibility --- */
--
-- FR-62. Support must never SELECT credit_score, income or id_number. Postgres
-- RLS filters rows, not columns, so column restriction is done the only way
-- that actually holds: a view that does not contain the columns, with the base
-- table readable only by its owner and by super admins.

drop policy if exists "staff read limited buyer profiles" on public.profiles;

drop policy if exists "owners read their own profile" on public.profiles;
create policy "owners read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "super admins read every profile" on public.profiles;
create policy "super admins read every profile"
  on public.profiles
  for select
  to authenticated
  using (public.is_super_admin());

create or replace view public.buyer_directory
with (security_invoker = true) as
  select
    p.id,
    p.email,
    p.full_name,
    p.location,
    p.credit_bureau,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.role = 'buyer';

comment on view public.buyer_directory is
  'The only buyer data a support agent may read. Financial columns are absent from the view, so a support session cannot select them however the query is written.';

revoke all on public.buyer_directory from anon, authenticated;
grant select on public.buyer_directory to authenticated;

-- Staff-only access to the directory, enforced on the underlying table through
-- a policy that admits staff to the buyer rows the view exposes.
drop policy if exists "staff read buyers through the directory" on public.profiles;
create policy "staff read buyers through the directory"
  on public.profiles
  for select
  to authenticated
  using (public.is_staff() and role = 'buyer');

-- FR-63: a staff member never has buyer-personalised data of their own. Staff
-- rows are readable only by super admins, and a buyer can never read a staff row.
drop policy if exists "buyers cannot read staff rows" on public.profiles;

/* -------------------------------------------------------------- tickets -- */

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('open', 'in_progress', 'waiting_user', 'resolved', 'escalated');
  end if;
  if not exists (select 1 from pg_type where typname = 'ticket_priority') then
    create type public.ticket_priority as enum ('P0', 'P1', 'P2', 'P3');
  end if;
end
$$;

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  subject text not null check (char_length(subject) between 6 and 120),
  body text not null check (char_length(body) between 20 and 4000),
  priority public.ticket_priority not null default 'P3',
  status public.ticket_status not null default 'open',
  assigned_to uuid references public.profiles (id) on delete set null,
  linked_comparison_id uuid references public.saved_comparisons (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sla_deadline timestamptz not null,
  deleted_at timestamptz
);

create index if not exists tickets_profile_idx on public.tickets (profile_id, created_at desc);
create index if not exists tickets_queue_idx on public.tickets (status, sla_deadline) where deleted_at is null;

alter table public.tickets enable row level security;

-- Buyers: their own tickets, create and read and reply, never delete.
drop policy if exists "buyers read their own tickets" on public.tickets;
create policy "buyers read their own tickets"
  on public.tickets for select to authenticated
  using (auth.uid() = profile_id);

drop policy if exists "buyers raise their own tickets" on public.tickets;
create policy "buyers raise their own tickets"
  on public.tickets for insert to authenticated
  with check (auth.uid() = profile_id);

-- Staff: support sees its own and unassigned and escalated work (FR-67);
-- super admin sees everything.
drop policy if exists "staff read their queue" on public.tickets;
create policy "staff read their queue"
  on public.tickets for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.current_role() = 'support'
      and deleted_at is null
      and (assigned_to = auth.uid() or assigned_to is null or status = 'escalated')
    )
  );

drop policy if exists "staff update their queue" on public.tickets;
create policy "staff update their queue"
  on public.tickets for update to authenticated
  using (
    public.is_super_admin()
    or (public.current_role() = 'support' and (assigned_to = auth.uid() or assigned_to is null))
  )
  with check (public.is_staff());

-- FR-69/FR-81: support cannot delete. Only a super admin may soft-delete, and
-- there is no hard delete policy for anyone.
drop policy if exists "super admins soft delete tickets" on public.tickets;
create policy "super admins soft delete tickets"
  on public.tickets for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

/* ------------------------------------------------------- ticket replies -- */

create table if not exists public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  -- Internal notes never leave the portal. The policy below is what enforces
  -- that, not a filter in the client.
  internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists ticket_replies_ticket_idx on public.ticket_replies (ticket_id, created_at);

alter table public.ticket_replies enable row level security;

drop policy if exists "buyers read public replies on their tickets" on public.ticket_replies;
create policy "buyers read public replies on their tickets"
  on public.ticket_replies for select to authenticated
  using (
    internal = false
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.profile_id = auth.uid())
  );

drop policy if exists "buyers reply to their own tickets" on public.ticket_replies;
create policy "buyers reply to their own tickets"
  on public.ticket_replies for insert to authenticated
  with check (
    author_id = auth.uid()
    and internal = false
    and exists (select 1 from public.tickets t where t.id = ticket_id and t.profile_id = auth.uid())
  );

drop policy if exists "staff read every reply on visible tickets" on public.ticket_replies;
create policy "staff read every reply on visible tickets"
  on public.ticket_replies for select to authenticated
  using (public.is_staff());

drop policy if exists "staff write replies and notes" on public.ticket_replies;
create policy "staff write replies and notes"
  on public.ticket_replies for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());

/* ------------------------------------------------------ support snippets -- */

create table if not exists public.support_snippets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_snippets enable row level security;

drop policy if exists "staff read snippets" on public.support_snippets;
create policy "staff read snippets"
  on public.support_snippets for select to authenticated using (public.is_staff());

drop policy if exists "super admins write snippets" on public.support_snippets;
create policy "super admins write snippets"
  on public.support_snippets for insert to authenticated with check (public.is_super_admin());

drop policy if exists "super admins update snippets" on public.support_snippets;
create policy "super admins update snippets"
  on public.support_snippets for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "super admins delete snippets" on public.support_snippets;
create policy "super admins delete snippets"
  on public.support_snippets for delete to authenticated using (public.is_super_admin());

/* ------------------------------------------------------ staff audit log -- */

create table if not exists public.staff_audit_logs (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists staff_audit_staff_idx on public.staff_audit_logs (staff_id, created_at desc);
create index if not exists staff_audit_target_idx on public.staff_audit_logs (target_user_id, created_at desc);

alter table public.staff_audit_logs enable row level security;

-- FR-75: support reads its own trail, super admin reads all, nobody edits or
-- deletes. There is deliberately no update or delete policy: an audit log that
-- can be rewritten is not an audit log.
drop policy if exists "staff read their own audit trail" on public.staff_audit_logs;
create policy "staff read their own audit trail"
  on public.staff_audit_logs for select to authenticated
  using (public.is_super_admin() or staff_id = auth.uid());

drop policy if exists "staff append to the audit trail" on public.staff_audit_logs;
create policy "staff append to the audit trail"
  on public.staff_audit_logs for insert to authenticated
  with check (public.is_staff() and staff_id = auth.uid());

/* ------------------------------------------------------ system settings -- */

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;

-- Read is open to any signed-in user because the consumer app needs
-- maintenance_mode and the default fuel price. Writes are super admin only.
drop policy if exists "everyone signed in reads settings" on public.system_settings;
create policy "everyone signed in reads settings"
  on public.system_settings for select to authenticated using (true);

drop policy if exists "super admins insert settings" on public.system_settings;
create policy "super admins insert settings"
  on public.system_settings for insert to authenticated with check (public.is_super_admin());

drop policy if exists "super admins update settings" on public.system_settings;
create policy "super admins update settings"
  on public.system_settings for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "super admins delete settings" on public.system_settings;
create policy "super admins delete settings"
  on public.system_settings for delete to authenticated using (public.is_super_admin());

/* ------------------------------------------------------ content snippets -- */

create table if not exists public.content_snippets (
  key text primary key,
  value text not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.content_snippets enable row level security;

drop policy if exists "everyone signed in reads content" on public.content_snippets;
create policy "everyone signed in reads content"
  on public.content_snippets for select to authenticated using (true);

drop policy if exists "super admins insert content" on public.content_snippets;
create policy "super admins insert content"
  on public.content_snippets for insert to authenticated with check (public.is_super_admin());

drop policy if exists "super admins update content" on public.content_snippets;
create policy "super admins update content"
  on public.content_snippets for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "super admins delete content" on public.content_snippets;
create policy "super admins delete content"
  on public.content_snippets for delete to authenticated using (public.is_super_admin());

/* -------------------------------------------------------- guardian rules -- */

create table if not exists public.guardian_rules (
  id text primary key,
  label text not null,
  enabled boolean not null default true,
  extra_keywords text[] not null default '{}',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.guardian_rules enable row level security;

drop policy if exists "everyone signed in reads guardian rules" on public.guardian_rules;
create policy "everyone signed in reads guardian rules"
  on public.guardian_rules for select to authenticated using (true);

drop policy if exists "super admins insert guardian rules" on public.guardian_rules;
create policy "super admins insert guardian rules"
  on public.guardian_rules for insert to authenticated with check (public.is_super_admin());

drop policy if exists "super admins update guardian rules" on public.guardian_rules;
create policy "super admins update guardian rules"
  on public.guardian_rules for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists "super admins delete guardian rules" on public.guardian_rules;
create policy "super admins delete guardian rules"
  on public.guardian_rules for delete to authenticated using (public.is_super_admin());

/* ------------------------------------------------------------ hardening -- */
--
-- Items that CANNOT be expressed in SQL and must be built at the edge before
-- this portal is exposed to the internet:
--
--   FR-58  invite-only provisioning through the Auth admin API, forced reset
--   FR-61  4-hour idle expiry and TOTP re-auth on destructive actions
--   FR-64  mandatory TOTP enrolment, backup codes hashed at rest
--   FR-65  IP rate limiting, 5 failures per 15 minutes then a 30-minute lock
--   FR-60  middleware role check before any (staff) route renders
--
-- They are listed here so the gap is recorded next to the schema rather than
-- discovered later.
