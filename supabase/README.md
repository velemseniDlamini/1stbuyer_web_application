# Supabase schema

## Status: applied, and auth plus profiles now run against it

The migrations in this folder **have been applied** to project
`qpjqveipehhxqyxhlwmy` (region eu-west-1). Twelve files, verified against the
running database.

What is true today:

| | |
| --- | --- |
| Schema applied | Yes, all 12 migrations, recorded in `public.schema_migrations` with checksums |
| RLS verified | Yes, live, by connecting as the `anon` role (`scripts/rls-check.mjs`) |
| Catalogue seeded | Yes, 7 dealers and 8 sample cars from `lib/data.ts` |
| App reads from it | **Partly.** Auth, profiles, credit history, documents and the new-car catalogue are live. Comparisons, tickets and staff are still local. |

The last row is the important one. Identity is now server-backed: the session
and the `profiles` row are the only source of truth for who is signed in, and
`lib/store.tsx` discards any local copy of them. Credit history and the finance
pack now behave the same way: they are written to Postgres before they appear on
screen, and in Supabase mode no copy is kept on disk, so a stale local value can
never be read back as if it were the server's answer. The remaining slices are
still browser-local, and the profile screen says so rather than implying it all
syncs.

## Connecting

`.env.local` (gitignored) holds the connection. Note the host:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

The documented direct host `db.<ref>.supabase.co` resolves to an **IPv6-only**
address. Machines without an IPv6 route get `ENOTFOUND` and cannot reach it, so
the IPv4 session pooler is used instead. It is the same database. Use port
`5432` (session mode) for migrations; transaction mode on `6543` does not
support all DDL cleanly.

## Scripts

| Command | What it does |
| --- | --- |
| `node scripts/migrate.mjs --dry` | Lists what would run, applies nothing |
| `node scripts/migrate.mjs` | Applies pending migrations, one transaction per file |
| `node scripts/verify.mjs` | Asserts RLS, policy coverage, the directory view and constraints against the live schema |
| `node scripts/rls-check.mjs` | Connects as `anon` and proves it can read and write nothing |
| `node scripts/seed.mjs` | Loads the sample catalogue; refuses to run if any buyer has saved a vehicle |
| `node scripts/seed-new-cars.mjs` | Upserts the researched new-car rows |
| `node scripts/verify-auth-rls.mjs` | Creates two real users and proves each can read and write only their own row |
| `node scripts/verify-sync.mjs` | Round-trips credit history and the finance pack as a signed-in user, and proves a second user sees none of it |

Migrations are recorded with a checksum. Editing an applied file is reported as
`CHANGED SINCE APPLYING` rather than silently re-run: write a new migration
instead, as `0007` does for `0006`.

## The tables

| Migration | Adds |
| --- | --- |
| `0000_base_schema` | `profiles`, `dealers`, `cars`, `credit_history`, `finance_scenarios`, `quotations`, `documents`, `saved_vehicles`, `notifications`, plus the `handle_new_user` trigger |
| `0001_car_specs` | `car_specs`, every value column nullable, provenance enforced by check constraint |
| `0002_saved_comparisons` | `saved_comparisons`, 2 to 3 distinct cars enforced in the database |
| `0003_comparison_shares` | `comparison_shares`, token-scoped anon read, no financial columns |
| `0004_price_snapshots` | `price_snapshots` for the sparkline |
| `0005_staff_and_support` | `staff_role` enum, `tickets`, `ticket_replies`, `support_snippets`, `staff_audit_logs`, `system_settings`, `content_snippets`, `guardian_rules`, and the `buyer_directory` view |
| `0006_lock_migration_ledger` | RLS on the ledger with no policies |
| `0007_revoke_ledger_grants` | Revokes ledger grants so a client query errors rather than returning empty |
| `0008_new_cars` | `new_cars`, every row required to cite publisher, URL and publication date |
| `0009_new_cars_public_read` | Anon read on that one table, because it holds only already-public list prices |
| `0010_lock_privileged_columns` | Column-level revoke plus trigger, so a buyer cannot make themselves staff |
| `0011_app_visits` | `app_visits` plus four aggregate functions. RLS with **no policies at all**: no browser can read or write it, and the aggregates are executable only by the service role |

## Security properties, verified live

- **Every** table in `public` has RLS enabled.
- Every per-user table carries all four policies (select, insert, update,
  delete) scoped through `auth.uid()`.
- `staff_audit_logs` has **only** select and insert. An audit log that can be
  updated or deleted is not an audit log.
- `tickets` has no delete policy at all: super admins soft-delete via
  `deleted_at`.
- `ticket_replies` has only select and insert: a thread is immutable.
- `buyer_directory` contains `id, email, full_name, location, credit_bureau,
  created_at, updated_at` and **no** financial columns. Support cannot select
  `credit_score`, `monthly_income` or `id_number` however the query is written,
  because those columns are not in the view and the base table is readable only
  by the owner and by super admins.
- As `anon`: zero rows from every table, and inserts refused with `42501`.

## Sample profiles

Quick sign-in creates (or signs into) a real account and then writes the
persona's credit history and finance pack to the database, but **only into an
account that has neither yet**. Signing into the same persona twice does not
stack a second copy of its score history, and a score you recorded yourself is
never overwritten by sample data.

## Auth

Sign-up goes through `POST /api/auth/register`, not the browser client.
This project has email confirmation on with no custom SMTP, so Supabase
tries to send a mail on every sign-up and its built-in mailer allows only a
couple per hour: the third person to sign up would hit
"email rate limit exceeded". The route creates the user already confirmed
with the service role, and the browser then signs in normally.

**That bypasses email verification.** Anyone can register an address they do
not own. Before this handles real money or real personal data, either turn on
a custom SMTP provider and use the normal confirmation flow, or add a
verification step to the route.

Supabase also rejects some domains outright (`.test` and `example.com` both
return "Email address is invalid"), which is why the sample profiles use
`@demo.1stbuyer.co.za`.

### Privilege escalation, found and fixed

Signing in as a real buyer and running
`update profiles set role = ... where id = auth.uid()` **succeeded**, because
row level security is row level and says nothing about columns. Migration
`0010` revokes column-level UPDATE on `role`, `is_suspended` and
`suspension_reason` from `authenticated` and `anon`, and adds a trigger as a
second line. `scripts/verify-auth-rls.mjs` re-runs the attack on demand.

## Still missing before this is production-safe

Applying schema is not the same as securing an application. These are **not**
done, and none of them can be done in SQL:

1. **Some slices are still local.** Auth, profiles, credit history, documents
   and the new-car catalogue are live. Comparisons, scenarios, quotations,
   tickets and the staff portal still read and write `localStorage`, so they do
   not follow a user between devices.
2. **No TOTP** for staff (FR-64). The staff portal authenticates in the browser.
3. **No invite flow** (FR-58). Staff accounts in the app are local seed data.
4. **No IP rate limiting** (FR-65). The lockout in `lib/staff.ts` is a
   client-side speed bump.
5. **No middleware role gate** (FR-60). The `(staff)` route check is a
   client-side redirect and can be bypassed from the console.
6. **The database password was shared in plaintext** and should be rotated in
   the dashboard once the client work is done.
