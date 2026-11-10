-- Platform-level read access for Super Admin overview and controlled package administration.
-- Customer transaction and payment tables intentionally remain tenant-scoped.
create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.platform_role = 'super_admin'
      and p.account_status = 'active'
  );
$$;
revoke all on function private.is_super_admin() from public;
grant execute on function private.is_super_admin() to authenticated;

drop policy if exists profiles_select_platform_admin on public.profiles;
create policy profiles_select_platform_admin on public.profiles
for select to authenticated using (private.is_super_admin());

drop policy if exists companies_select_platform_admin on public.companies;
create policy companies_select_platform_admin on public.companies
for select to authenticated using (private.is_super_admin());

drop policy if exists tenants_select_platform_admin on public.tenants;
create policy tenants_select_platform_admin on public.tenants
for select to authenticated using (private.is_super_admin());

drop policy if exists company_members_select_platform_admin on public.company_members;
create policy company_members_select_platform_admin on public.company_members
for select to authenticated using (private.is_super_admin());

drop policy if exists packages_manage_platform_admin on public.packages;
create policy packages_manage_platform_admin on public.packages
for all to authenticated using (private.is_super_admin())
with check (private.is_super_admin());

drop policy if exists subscriptions_select_platform_admin on public.company_subscriptions;
create policy subscriptions_select_platform_admin on public.company_subscriptions
for select to authenticated using (private.is_super_admin());

drop policy if exists audit_logs_select_platform_admin on public.audit_logs;
create policy audit_logs_select_platform_admin on public.audit_logs
for select to authenticated using (private.is_super_admin());
