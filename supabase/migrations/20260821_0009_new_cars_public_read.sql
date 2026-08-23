-- Public read for the new-car price list, and ONLY for that table.
--
-- Every other table in this schema is either per-user data behind auth.uid()
-- or catalogue data limited to signed-in users. new_cars is different in kind:
-- every row is a manufacturer list price already published in a public article,
-- with the article's URL stored alongside it. There is nothing in the table
-- that is not already public, and no row is attributable to a person.
--
-- Granting anon read lets a visitor browse new-car prices before creating an
-- account, which is the point of the screen. It does not widen access to
-- anything else: this policy names one table.
--
-- Writes remain service-role only. There is no insert, update or delete policy
-- for anon or authenticated anywhere on this table.

drop policy if exists "new_cars: public read" on public.new_cars;
create policy "new_cars: public read"
  on public.new_cars
  for select
  to anon
  using (true);

comment on policy "new_cars: public read" on public.new_cars is
  'Published list prices with their sources. Public by design; the table holds no personal data.';
