
create or replace function private.is_platform_admin()
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.platform_role in ('super_admin','admin_platform') and p.account_status='active');
$$;
revoke all on function private.is_platform_admin() from public;
grant execute on function private.is_platform_admin() to authenticated;

drop policy if exists companies_select_platform_staff on public.companies;
create policy companies_select_platform_staff on public.companies for select to authenticated using(private.is_platform_admin());
drop policy if exists tenants_select_platform_staff on public.tenants;
create policy tenants_select_platform_staff on public.tenants for select to authenticated using(private.is_platform_admin());
drop policy if exists subscriptions_select_platform_staff on public.company_subscriptions;
create policy subscriptions_select_platform_staff on public.company_subscriptions for select to authenticated using(private.is_platform_admin());
drop policy if exists subscription_payments_platform_staff_select on public.subscription_payment_requests;
create policy subscription_payments_platform_staff_select on public.subscription_payment_requests for select to authenticated using(private.is_platform_admin());
drop policy if exists audit_logs_select_platform_staff on public.audit_logs;
create policy audit_logs_select_platform_staff on public.audit_logs for select to authenticated using(private.is_platform_admin());
