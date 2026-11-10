
create unique index if not exists company_subscriptions_one_per_company on public.company_subscriptions(company_id);

drop policy if exists profiles_select_assigned_company_staff on public.profiles;
create policy profiles_select_assigned_company_staff on public.profiles for select to authenticated
using(
 exists(
  select 1 from public.tenant_members target
  join public.tenants t on t.id=target.tenant_id
  join public.companies c on c.id=t.company_id
  where target.user_id=profiles.id
   and (c.owner_user_id=(select auth.uid()) or private.has_tenant_permission(target.tenant_id,'employees.manage'))
 )
 or exists(
  select 1 from public.company_members target_cm
  join public.companies c on c.id=target_cm.company_id
  where target_cm.user_id=profiles.id and c.owner_user_id=(select auth.uid())
 )
);
