
-- Permission evaluation must honor account suspension and tenant/company read-only states.
create or replace function private.has_tenant_permission(p_tenant_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.tenants t join public.companies c on c.id=t.company_id
  join public.company_subscriptions s on s.company_id=c.id join public.profiles p on p.id=(select auth.uid())
  where t.id=p_tenant_id and t.status='active' and c.status='active' and c.owner_user_id=(select auth.uid()) and p.account_status='active'
   and s.status='active' and s.starts_at<=now() and s.ends_at>now()
 ) or exists(
  select 1 from public.tenant_members tm join public.tenants t on t.id=tm.tenant_id
  join public.companies c on c.id=t.company_id join public.company_subscriptions s on s.company_id=c.id
  join public.tenant_member_permissions tp on tp.tenant_id=tm.tenant_id and tp.user_id=tm.user_id
  join public.profiles p on p.id=tm.user_id
  where tm.tenant_id=p_tenant_id and tm.user_id=(select auth.uid()) and tm.is_active and p.account_status='active'
   and t.status='active' and c.status='active' and tp.permission_key=p_permission and tp.granted
   and s.status='active' and s.starts_at<=now() and s.ends_at>now()
 );
$$;
drop policy if exists attendance_select_tenant on public.attendance_records;
create policy attendance_select_tenant on public.attendance_records for select to authenticated
using(employee_id=(select auth.uid()) or private.has_tenant_permission(tenant_id,'attendance.view') or private.has_tenant_permission(tenant_id,'attendance.correct'));

create table if not exists public.queue_daily_counters(
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 queue_date date not null,
 last_number integer not null default 0,
 primary key(tenant_id,queue_date)
);
alter table public.queue_daily_counters enable row level security;
create unique index if not exists queue_tickets_tenant_number_unique on public.queue_tickets(tenant_id,ticket_number);
create or replace function public.create_queue_ticket(p_tenant_id uuid,p_customer_name text default null,p_counter_name text default null)
returns public.queue_tickets language plpgsql security definer set search_path=''
as $$
declare v_number integer; v_prefix text; v_ticket public.queue_tickets%rowtype;
begin
 if not private.has_tenant_permission(p_tenant_id,'queue.manage') then raise exception 'Queue permission or active subscription required'; end if;
 insert into public.queue_daily_counters(tenant_id,queue_date,last_number) values(p_tenant_id,(clock_timestamp() at time zone 'Asia/Jakarta')::date,1)
 on conflict(tenant_id,queue_date) do update set last_number=public.queue_daily_counters.last_number+1
 returning last_number into v_number;
 select coalesce(settings#>>'{queue,prefix}','A') into v_prefix from public.tenant_settings where tenant_id=p_tenant_id;
 v_prefix:=coalesce(nullif(v_prefix,''),'A');
 insert into public.queue_tickets(tenant_id,ticket_number,customer_name,counter_name,status)
 values(p_tenant_id,v_prefix||to_char((clock_timestamp() at time zone 'Asia/Jakarta')::date,'YYMMDD')||lpad(v_number::text,3,'0'),nullif(p_customer_name,''),nullif(p_counter_name,''),'waiting')
 returning * into v_ticket;
 return v_ticket;
end;
$$;
revoke all on function public.create_queue_ticket(uuid,text,text) from public,anon;
grant execute on function public.create_queue_ticket(uuid,text,text) to authenticated;

alter table public.self_orders add column if not exists payment_reference text;
create or replace function public.get_self_order_catalog(p_tenant_slug text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_tenant public.tenants%rowtype; v_settings jsonb;
begin
 select * into v_tenant from public.tenants where slug=p_tenant_slug and status='active';
 if not found then raise exception 'Toko tidak ditemukan atau tidak aktif'; end if;
 select settings into v_settings from public.tenant_settings where tenant_id=v_tenant.id;
 if coalesce((v_settings#>>'{self_order,enabled}')::boolean,false)=false then raise exception 'Self Order belum diaktifkan oleh toko'; end if;
 if not exists(select 1 from public.company_subscriptions s join public.companies c on c.id=s.company_id where c.id=v_tenant.company_id and c.status='active' and s.status='active' and s.starts_at<=now() and s.ends_at>now()) then raise exception 'Layanan Self Order sedang tidak tersedia'; end if;
 return jsonb_build_object('tenant_id',v_tenant.id,'tenant_name',v_tenant.name,'settings',coalesce(v_settings#>'{self_order}','{}'::jsonb),
  'products',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'price',p.sale_price,'category',pc.name) order by p.name) from public.products p left join public.product_categories pc on pc.id=p.category_id where p.tenant_id=v_tenant.id and p.is_active),'[]'::jsonb));
end;
$$;
revoke all on function public.get_self_order_catalog(text) from public;
grant execute on function public.get_self_order_catalog(text) to anon,authenticated;

create or replace function public.create_self_order(p_tenant_slug text,p_customer_name text,p_customer_contact text,p_payment_method text,p_items jsonb,p_payment_reference text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_tenant public.tenants%rowtype; v_settings jsonb; v_item jsonb; v_product public.products%rowtype; v_qty numeric; v_total numeric(14,2):=0; v_id uuid; v_no text;
begin
 if nullif(trim(p_customer_name),'') is null then raise exception 'Nama pelanggan wajib diisi'; end if;
 if p_payment_method not in ('cash','transfer','qris') then raise exception 'Metode pembayaran tidak valid'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Keranjang kosong'; end if;
 select * into v_tenant from public.tenants where slug=p_tenant_slug and status='active';
 if not found then raise exception 'Toko tidak ditemukan'; end if;
 select settings into v_settings from public.tenant_settings where tenant_id=v_tenant.id;
 if coalesce((v_settings#>>'{self_order,enabled}')::boolean,false)=false then raise exception 'Self Order tidak aktif'; end if;
 if not exists(select 1 from public.company_subscriptions s join public.companies c on c.id=s.company_id where c.id=v_tenant.company_id and c.status='active' and s.status='active' and s.starts_at<=now() and s.ends_at>now()) then raise exception 'Layanan tidak tersedia'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric;
  if v_qty<=0 then raise exception 'Jumlah produk tidak valid'; end if;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and tenant_id=v_tenant.id and is_active;
  if not found then raise exception 'Produk tidak tersedia'; end if;
  v_total:=v_total+round(v_product.sale_price*v_qty,2);
 end loop;
 v_no:='SO-'||to_char(clock_timestamp() at time zone 'Asia/Jakarta','YYMMDD-HH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
 insert into public.self_orders(tenant_id,order_number,customer_name,customer_contact,payment_method,payment_status,order_status,payment_reference,total_amount)
 values(v_tenant.id,v_no,trim(p_customer_name),nullif(p_customer_contact,''),p_payment_method,case when p_payment_method='cash' then 'pending' else 'submitted' end,'received',nullif(p_payment_reference,''),v_total)
 returning id into v_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and tenant_id=v_tenant.id;
  insert into public.self_order_items(self_order_id,product_id,product_name_snapshot,quantity,unit_price,item_note)
  values(v_id,v_product.id,v_product.name,v_qty,v_product.sale_price,nullif(v_item->>'note',''));
 end loop;
 return v_id;
end;
$$;
revoke all on function public.create_self_order(text,text,text,text,jsonb,text) from public;
grant execute on function public.create_self_order(text,text,text,text,jsonb,text) to anon,authenticated;

create table if not exists public.support_conversations(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 tenant_id uuid references public.tenants(id) on delete set null,
 created_by uuid not null references public.profiles(id),
 assigned_to uuid references public.profiles(id),
 subject text not null default 'Bantuan acoPos',
 status text not null default 'open' check(status in ('open','waiting','closed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.support_messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.support_conversations(id) on delete cascade,
 sender_id uuid not null references public.profiles(id),
 body text not null check(length(trim(body))>0 and length(body)<=5000),
 created_at timestamptz not null default now()
);
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
drop policy if exists support_conversations_select on public.support_conversations;
create policy support_conversations_select on public.support_conversations for select to authenticated
using(created_by=(select auth.uid()) or private.is_platform_admin() or private.has_company_access(company_id));
drop policy if exists support_conversations_insert on public.support_conversations;
create policy support_conversations_insert on public.support_conversations for insert to authenticated
with check(created_by=(select auth.uid()) and private.has_company_access(company_id));
drop policy if exists support_conversations_update on public.support_conversations;
create policy support_conversations_update on public.support_conversations for update to authenticated
using(private.is_platform_admin() or created_by=(select auth.uid())) with check(private.is_platform_admin() or created_by=(select auth.uid()));
drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select to authenticated
using(exists(select 1 from public.support_conversations c where c.id=conversation_id and (c.created_by=(select auth.uid()) or private.is_platform_admin() or private.has_company_access(c.company_id))));
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages for insert to authenticated
with check(sender_id=(select auth.uid()) and exists(select 1 from public.support_conversations c where c.id=conversation_id and (c.created_by=(select auth.uid()) or private.is_platform_admin() or private.has_company_access(c.company_id))));
create index if not exists support_messages_conversation_created_idx on public.support_messages(conversation_id,created_at);
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_messages') then alter publication supabase_realtime add table public.support_messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='support_conversations') then alter publication supabase_realtime add table public.support_conversations; end if;
end $$;
