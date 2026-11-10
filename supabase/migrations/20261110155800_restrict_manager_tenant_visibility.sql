
drop policy if exists tenants_select_company on public.tenants;
create policy tenants_select_company on public.tenants for select to authenticated
using(
 private.is_company_owner(company_id)
 or exists(select 1 from public.tenant_members tm where tm.tenant_id=tenants.id and tm.user_id=(select auth.uid()) and tm.is_active)
);
