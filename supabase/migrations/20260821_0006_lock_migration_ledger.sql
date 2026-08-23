-- The migration ledger is operational metadata, not application data. Nothing
-- in the client should read it, so RLS is enabled with NO policies at all:
-- anon and authenticated get nothing, the service role (which bypasses RLS)
-- keeps working. This also clears the "table without RLS" lint on a public
-- schema table.

alter table public.schema_migrations enable row level security;

comment on table public.schema_migrations is
  'Applied migration ledger with checksums. RLS enabled with no policies: readable only by the service role.';
