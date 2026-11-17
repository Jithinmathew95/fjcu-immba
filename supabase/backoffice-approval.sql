-- Back-office approval add-on: permanent delete for rejected accounts.
-- Paste this whole file into the Supabase SQL Editor and run it.
-- Safe to run more than once.
--
-- Adds ONE function only. It does not change the profiles table, the
-- private.* helpers, the sign-up trigger, or any existing policies.
--
-- Roles on public.profiles.role (already in place):
--   pending      every new sign-up (back office and marketplace);
--                cannot edit Faculty or News
--   admin        staff; private.is_staff() is true
--   super_admin  staff plus user management
--   rejected     no back-office access; the ONLY role that can be deleted
--
-- admin_delete_user refuses unless ALL of these are true:
--   - the caller is signed in and is a super admin
--   - the target is not the caller and not another super admin
--   - the target's role is 'rejected' (use Reject or Remove access first)
--   - the target is not a seller, not a platform admin, and not a professor
-- This stops the Delete button from removing ordinary marketplace accounts.
create or replace function public.admin_delete_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
  target_is_seller boolean;
  target_is_platform_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if not private.is_super_admin() then
    raise exception 'Only a super admin can delete users.';
  end if;
  if target_id is null or target_id = auth.uid() then
    raise exception 'You cannot delete your own account.';
  end if;
  select role, is_seller, is_platform_admin
    into target_role, target_is_seller, target_is_platform_admin
  from public.profiles
  where id = target_id;
  if not found then
    raise exception 'That user was not found.';
  end if;
  if target_role = 'super_admin' then
    raise exception 'You cannot delete another super admin.';
  end if;
  if target_role is distinct from 'rejected' then
    raise exception 'Only rejected accounts can be deleted. Reject them or remove their access first.';
  end if;
  if coalesce(target_is_seller, false) or coalesce(target_is_platform_admin, false) then
    raise exception 'Sellers and platform admins cannot be deleted here.';
  end if;
  if exists (select 1 from public.professors where user_id = target_id) then
    raise exception 'Professors cannot be deleted here.';
  end if;
  -- The profile row is removed with the Auth user (on delete cascade).
  -- If the account is linked to marketplace data that blocks deletion,
  -- Postgres raises a foreign key error and nothing is deleted.
  delete from auth.users
  where id = target_id;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
