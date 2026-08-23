-- Defence in depth for the migration ledger.
--
-- 0006 enabled RLS with no policies, so a client query returns zero rows. That
-- contains the data, but the query still succeeds. Revoking the table grants
-- turns it into a permission error instead, which is the stronger result: a
-- client should not be able to confirm the table is even queryable.
--
-- Added as a new migration rather than by editing 0006, because 0006 is already
-- recorded in the ledger with its checksum.

revoke all on table public.schema_migrations from anon, authenticated;
