-- Privilege escalation fix.
--
-- THE HOLE. The "profiles: owner updates" policy lets a signed-in user update
-- their own row. Row level security is exactly that: ROW level. It says nothing
-- about which COLUMNS may be written, so a buyer could send
--
--   update profiles set role = 'super_admin' where id = auth.uid()
--
-- and become a super admin. Found by signing in as a real buyer and trying it,
-- not by reading the policy: the policy is correct, it just does not do what
-- reading it casually suggests.
--
-- THE FIX. Column-level privileges, which are checked before RLS and which RLS
-- cannot override. The authenticated and anon roles lose UPDATE on the three
-- columns that decide privilege and suspension. service_role keeps them, so
-- staff provisioning through the admin portal still works.

revoke update (role, is_suspended, suspension_reason) on public.profiles from authenticated;
revoke update (role, is_suspended, suspension_reason) on public.profiles from anon;

-- Belt and braces: a trigger that refuses the change even if a future migration
-- re-grants the column by accident. It compares against the OLD row, so a
-- service-role write (which is how roles are legitimately granted) still passes
-- only when it comes from a super admin or from a session with no JWT at all
-- (the service role has no auth.uid()).
create or replace function public.guard_privileged_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     or new.is_suspended is distinct from old.is_suspended then
    -- auth.uid() is null for the service role and for SQL run by an operator.
    if auth.uid() is not null and not public.is_super_admin() then
      raise exception 'role and suspension are not self-serve'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_privileged_profile_columns();

comment on function public.guard_privileged_profile_columns is
  'Blocks self-promotion to staff and self-unsuspension. Column grants are the primary control; this trigger is the second line.';
