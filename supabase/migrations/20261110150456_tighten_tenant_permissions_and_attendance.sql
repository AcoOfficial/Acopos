-- Tighten tenant permissions, gate operational writes on an active Company subscription,
-- provision profile rows on Auth signup, and support employee self check-out.
create or replace function private.has_tenant_permission(p_tenant_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenants t
    join public.companies c on c.id = t.company_id
    join public.company_subscriptions s on s.company_id = c.id
    join public.profiles p on p.id = (select auth.uid())
    where t.id = p_tenant_id and c.owner_user_id = (select auth.uid())
      and t.status = 'active' and c.status = 'active' and p.account_status = 'active'
      and s.status = 'active' and s.starts_at <= now() and s.ends_at > now()
  ) or exists (
    select 1 from public.tenant_members tm
    join public.tenants t on t.id = tm.tenant_id
    join public.companies c on c.id = t.company_id
    join public.company_subscriptions s on s.company_id = c.id
    join public.tenant_member_permissions tp on tp.tenant_id = tm.tenant_id and tp.user_id = tm.user_id
    join public.profiles p on p.id = tm.user_id
    where tm.tenant_id = p_tenant_id and tm.user_id = (select auth.uid())
      and tm.is_active and t.status = 'active' and c.status = 'active'
      and p.account_status = 'active' and tp.permission_key = p_permission and tp.granted
      and s.status = 'active' and s.starts_at <= now() and s.ends_at > now()
  );
$$;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id,display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

insert into public.profiles(id,display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name','')
from auth.users
on conflict (id) do nothing;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function private.handle_new_user();

create policy activation_codes_no_client_access
on public.activation_codes for all to authenticated
using (false) with check (false);

drop policy tenant_members_manage on public.tenant_members;
create policy tenant_members_insert_manage on public.tenant_members for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'employees.manage'));
create policy tenant_members_update_manage on public.tenant_members for update to authenticated
using (private.has_tenant_permission(tenant_id,'employees.manage'))
with check (private.has_tenant_permission(tenant_id,'employees.manage'));
create policy tenant_members_delete_manage on public.tenant_members for delete to authenticated
using (private.has_tenant_permission(tenant_id,'employees.manage'));

drop policy tenant_permissions_manage on public.tenant_member_permissions;
create policy tenant_permissions_insert_manage on public.tenant_member_permissions for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'employees.manage'));
create policy tenant_permissions_update_manage on public.tenant_member_permissions for update to authenticated
using (private.has_tenant_permission(tenant_id,'employees.manage'))
with check (private.has_tenant_permission(tenant_id,'employees.manage'));
create policy tenant_permissions_delete_manage on public.tenant_member_permissions for delete to authenticated
using (private.has_tenant_permission(tenant_id,'employees.manage'));

drop policy categories_manage_tenant on public.product_categories;
create policy categories_insert_tenant on public.product_categories for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'products.manage'));
create policy categories_update_tenant on public.product_categories for update to authenticated
using (private.has_tenant_permission(tenant_id,'products.manage'))
with check (private.has_tenant_permission(tenant_id,'products.manage'));
create policy categories_delete_tenant on public.product_categories for delete to authenticated
using (private.has_tenant_permission(tenant_id,'products.manage'));

drop policy products_manage_tenant on public.products;
create policy products_insert_tenant on public.products for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'products.manage'));
create policy products_update_tenant on public.products for update to authenticated
using (private.has_tenant_permission(tenant_id,'products.manage'))
with check (private.has_tenant_permission(tenant_id,'products.manage'));
create policy products_delete_tenant on public.products for delete to authenticated
using (private.has_tenant_permission(tenant_id,'products.manage'));

drop policy registers_manage_tenant on public.registers;
create policy registers_insert_tenant on public.registers for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'cashier.manage'));
create policy registers_update_tenant on public.registers for update to authenticated
using (private.has_tenant_permission(tenant_id,'cashier.manage'))
with check (private.has_tenant_permission(tenant_id,'cashier.manage'));
create policy registers_delete_tenant on public.registers for delete to authenticated
using (private.has_tenant_permission(tenant_id,'cashier.manage'));

drop policy tenant_settings_manage on public.tenant_settings;
create policy tenant_settings_insert on public.tenant_settings for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'settings.manage'));
create policy tenant_settings_update on public.tenant_settings for update to authenticated
using (private.has_tenant_permission(tenant_id,'settings.manage'))
with check (private.has_tenant_permission(tenant_id,'settings.manage'));
create policy tenant_settings_delete on public.tenant_settings for delete to authenticated
using (private.has_tenant_permission(tenant_id,'settings.manage'));

drop policy display_devices_manage on public.customer_display_devices;
create policy display_devices_insert on public.customer_display_devices for insert to authenticated
with check (private.has_tenant_permission(tenant_id,'settings.manage'));
create policy display_devices_update on public.customer_display_devices for update to authenticated
using (private.has_tenant_permission(tenant_id,'settings.manage'))
with check (private.has_tenant_permission(tenant_id,'settings.manage'));
create policy display_devices_delete on public.customer_display_devices for delete to authenticated
using (private.has_tenant_permission(tenant_id,'settings.manage'));

create policy attendance_manual_checkout on public.attendance_records for update to authenticated
using (employee_id = (select auth.uid()) and source = 'manual' and check_out_at is null)
with check (employee_id = (select auth.uid()) and source = 'manual' and check_out_at is not null);

create index if not exists activation_codes_redeemed_by_idx on public.activation_codes(redeemed_by);
create index if not exists attendance_cashier_session_idx on public.attendance_records(cashier_session_id);
create index if not exists attendance_corrected_by_idx on public.attendance_records(corrected_by);
create index if not exists attendance_employee_idx on public.attendance_records(employee_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id);
create index if not exists audit_logs_tenant_idx on public.audit_logs(tenant_id);
create index if not exists cashier_closings_confirmed_by_idx on public.cashier_session_closings(confirmed_by);
create index if not exists cashier_sessions_closed_by_idx on public.cashier_sessions(closed_by);
create index if not exists cashier_sessions_opened_by_idx on public.cashier_sessions(opened_by);
create index if not exists cashier_sessions_tenant_idx on public.cashier_sessions(tenant_id);
create index if not exists companies_owner_idx on public.companies(owner_user_id);
create index if not exists company_members_user_idx on public.company_members(user_id);
create index if not exists company_subscriptions_company_idx on public.company_subscriptions(company_id);
create index if not exists company_subscriptions_package_idx on public.company_subscriptions(package_id);
create index if not exists display_devices_register_idx on public.customer_display_devices(register_id);
create index if not exists display_devices_tenant_idx on public.customer_display_devices(tenant_id);
create index if not exists inventory_actor_idx on public.inventory_movements(actor_id);
create index if not exists inventory_tenant_idx on public.inventory_movements(tenant_id);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists transactions_cashier_idx on public.sales_transactions(cashier_id);
create index if not exists transactions_session_idx on public.sales_transactions(cashier_session_id);
create index if not exists self_order_items_product_idx on public.self_order_items(product_id);
create index if not exists self_order_items_order_idx on public.self_order_items(self_order_id);
create index if not exists permission_granted_by_idx on public.tenant_member_permissions(granted_by);
create index if not exists permission_user_idx on public.tenant_member_permissions(user_id);
create index if not exists settings_updated_by_idx on public.tenant_settings(updated_by);
create index if not exists transaction_items_product_idx on public.transaction_items(product_id);
create index if not exists transaction_items_transaction_idx on public.transaction_items(transaction_id);
create index if not exists transaction_payments_transaction_idx on public.transaction_payments(transaction_id);
