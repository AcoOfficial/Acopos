
create table if not exists public.customers(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 name text not null,
 phone text,
 email text,
 address text,
 notes text,
 is_active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(tenant_id,phone)
);
alter table public.customers enable row level security;
drop policy if exists customers_select_tenant on public.customers;
create policy customers_select_tenant on public.customers for select to authenticated using(private.has_tenant_access(tenant_id));
drop policy if exists customers_insert_tenant on public.customers;
create policy customers_insert_tenant on public.customers for insert to authenticated with check(private.has_tenant_permission(tenant_id,'customers.manage'));
drop policy if exists customers_update_tenant on public.customers;
create policy customers_update_tenant on public.customers for update to authenticated using(private.has_tenant_permission(tenant_id,'customers.manage')) with check(private.has_tenant_permission(tenant_id,'customers.manage'));
drop policy if exists customers_delete_tenant on public.customers;
create policy customers_delete_tenant on public.customers for delete to authenticated using(private.has_tenant_permission(tenant_id,'customers.manage'));

alter table public.sales_transactions add column if not exists customer_id uuid references public.customers(id) on delete set null;
alter table public.sales_transactions add column if not exists customer_name_snapshot text;
alter table public.sales_transactions add column if not exists customer_phone_snapshot text;

drop function if exists public.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric);
create function public.complete_pos_sale(
 p_tenant_id uuid,p_register_id uuid,p_session_id uuid,p_items jsonb,p_payments jsonb,
 p_order_note text default null,p_discount numeric default 0,p_tax numeric default 0,p_customer_id uuid default null
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_tx uuid; v_customer public.customers%rowtype;
begin
 if p_customer_id is not null then
  select * into v_customer from public.customers where id=p_customer_id and tenant_id=p_tenant_id and is_active;
  if not found then raise exception 'Customer is not active in this Tenant'; end if;
 end if;
 v_tx:=private.complete_pos_sale(p_tenant_id,p_register_id,p_session_id,p_items,p_payments,p_order_note,p_discount,p_tax);
 if p_customer_id is not null then
  update public.sales_transactions set customer_id=v_customer.id,customer_name_snapshot=v_customer.name,customer_phone_snapshot=v_customer.phone where id=v_tx;
 end if;
 return v_tx;
end;
$$;
revoke all on function public.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric,uuid) from public,anon;
grant execute on function public.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric,uuid) to authenticated;
