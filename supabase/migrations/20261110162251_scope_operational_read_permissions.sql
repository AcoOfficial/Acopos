create or replace function private.has_tenant_read_permission(p_tenant_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.tenants t
    join public.companies c on c.id = t.company_id
    join public.profiles p on p.id = (select auth.uid())
    where t.id = p_tenant_id
      and c.owner_user_id = (select auth.uid())
      and c.status <> 'suspended'
      and p.account_status = 'active'
  ) or exists (
    select 1
    from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    join public.companies c on c.id = t.company_id
    join public.tenant_member_permissions tp
      on tp.tenant_id = tm.tenant_id and tp.user_id = tm.user_id
    join public.profiles p on p.id = tm.user_id
    where tm.tenant_id = p_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
      and t.status = 'active'
      and c.status <> 'suspended'
      and p.account_status = 'active'
      and tp.permission_key = p_permission
      and tp.granted
  );
$function$;

revoke all on function private.has_tenant_read_permission(uuid,text) from public, anon;
grant execute on function private.has_tenant_read_permission(uuid,text) to authenticated;

drop policy if exists transactions_select_tenant on public.sales_transactions;
create policy transactions_select_tenant on public.sales_transactions
for select to authenticated
using (
  private.has_tenant_read_permission(tenant_id,'transactions.view')
  or private.has_tenant_read_permission(tenant_id,'pos.use')
  or private.has_tenant_read_permission(tenant_id,'reports.view')
);

drop policy if exists transaction_items_select_scope on public.transaction_items;
create policy transaction_items_select_scope on public.transaction_items
for select to authenticated
using (
  exists (
    select 1 from public.sales_transactions t
    where t.id = transaction_items.transaction_id
      and (
        private.has_tenant_read_permission(t.tenant_id,'transactions.view')
        or private.has_tenant_read_permission(t.tenant_id,'pos.use')
        or private.has_tenant_read_permission(t.tenant_id,'reports.view')
      )
  )
);

drop policy if exists transaction_payments_select_scope on public.transaction_payments;
create policy transaction_payments_select_scope on public.transaction_payments
for select to authenticated
using (
  exists (
    select 1 from public.sales_transactions t
    where t.id = transaction_payments.transaction_id
      and (
        private.has_tenant_read_permission(t.tenant_id,'transactions.view')
        or private.has_tenant_read_permission(t.tenant_id,'pos.use')
        or private.has_tenant_read_permission(t.tenant_id,'reports.view')
      )
  )
);

drop policy if exists cashier_sessions_select_tenant on public.cashier_sessions;
create policy cashier_sessions_select_tenant on public.cashier_sessions
for select to authenticated
using (
  private.has_tenant_read_permission(tenant_id,'cashier.open')
  or private.has_tenant_read_permission(tenant_id,'cashier.manage')
  or private.has_tenant_read_permission(tenant_id,'pos.use')
  or private.has_tenant_read_permission(tenant_id,'reports.view')
);

drop policy if exists cashier_closings_select_tenant on public.cashier_session_closings;
create policy cashier_closings_select_tenant on public.cashier_session_closings
for select to authenticated
using (
  exists (
    select 1 from public.cashier_sessions s
    where s.id = cashier_session_closings.session_id
      and (
        private.has_tenant_read_permission(s.tenant_id,'cashier.open')
        or private.has_tenant_read_permission(s.tenant_id,'cashier.manage')
        or private.has_tenant_read_permission(s.tenant_id,'pos.use')
        or private.has_tenant_read_permission(s.tenant_id,'reports.view')
      )
  )
);

drop policy if exists inventory_select_tenant on public.inventory_movements;
create policy inventory_select_tenant on public.inventory_movements
for select to authenticated
using (
  private.has_tenant_read_permission(tenant_id,'inventory.manage')
  or private.has_tenant_read_permission(tenant_id,'reports.view')
);
