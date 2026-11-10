drop policy if exists transactions_select_tenant on public.sales_transactions;
create policy transactions_select_tenant on public.sales_transactions
for select to authenticated
using (
  private.has_tenant_read_permission(tenant_id,'transactions.view')
  or private.has_tenant_read_permission(tenant_id,'reports.view')
  or private.has_tenant_read_permission(tenant_id,'cashier.manage')
  or (
    cashier_id = (select auth.uid())
    and (
      private.has_tenant_read_permission(tenant_id,'pos.use')
      or private.has_tenant_read_permission(tenant_id,'cashier.open')
    )
  )
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
        or private.has_tenant_read_permission(t.tenant_id,'reports.view')
        or private.has_tenant_read_permission(t.tenant_id,'cashier.manage')
        or (t.cashier_id = (select auth.uid()) and (
          private.has_tenant_read_permission(t.tenant_id,'pos.use')
          or private.has_tenant_read_permission(t.tenant_id,'cashier.open')
        ))
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
        or private.has_tenant_read_permission(t.tenant_id,'reports.view')
        or private.has_tenant_read_permission(t.tenant_id,'cashier.manage')
        or (t.cashier_id = (select auth.uid()) and (
          private.has_tenant_read_permission(t.tenant_id,'pos.use')
          or private.has_tenant_read_permission(t.tenant_id,'cashier.open')
        ))
      )
  )
);

drop policy if exists cashier_sessions_select_tenant on public.cashier_sessions;
create policy cashier_sessions_select_tenant on public.cashier_sessions
for select to authenticated
using (
  private.has_tenant_read_permission(tenant_id,'cashier.manage')
  or private.has_tenant_read_permission(tenant_id,'reports.view')
  or (
    opened_by = (select auth.uid())
    and (
      private.has_tenant_read_permission(tenant_id,'cashier.open')
      or private.has_tenant_read_permission(tenant_id,'pos.use')
    )
  )
);

drop policy if exists cashier_closings_select_tenant on public.cashier_session_closings;
create policy cashier_closings_select_tenant on public.cashier_session_closings
for select to authenticated
using (
  exists (
    select 1 from public.cashier_sessions s
    where s.id = cashier_session_closings.session_id
      and (
        private.has_tenant_read_permission(s.tenant_id,'cashier.manage')
        or private.has_tenant_read_permission(s.tenant_id,'reports.view')
        or (
          s.opened_by = (select auth.uid())
          and (
            private.has_tenant_read_permission(s.tenant_id,'cashier.open')
            or private.has_tenant_read_permission(s.tenant_id,'pos.use')
          )
        )
      )
  )
);
