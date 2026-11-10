
alter table public.self_orders add column if not exists payment_proof_token uuid;
update public.self_orders set payment_proof_token=gen_random_uuid() where payment_proof_token is null;
alter table public.self_orders alter column payment_proof_token set default gen_random_uuid();
alter table public.self_orders alter column payment_proof_token set not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('self-order-payment-proofs','self-order-payment-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

drop policy if exists self_order_proof_public_upload on storage.objects;
create policy self_order_proof_public_upload on storage.objects for insert to anon,authenticated
with check(
 bucket_id='self-order-payment-proofs'
 and array_length(storage.foldername(name),1)>=3
 and exists(
  select 1 from public.self_orders so
  where so.tenant_id=(storage.foldername(name))[1]::uuid
   and so.id=(storage.foldername(name))[2]::uuid
   and so.payment_proof_token=(storage.foldername(name))[3]::uuid
   and so.payment_status='submitted'
 )
);
drop policy if exists self_order_proof_staff_read on storage.objects;
create policy self_order_proof_staff_read on storage.objects for select to authenticated
using(
 bucket_id='self-order-payment-proofs'
 and array_length(storage.foldername(name),1)>=3
 and private.has_tenant_permission((storage.foldername(name))[1]::uuid,'self_order.manage')
);

drop function if exists public.create_self_order(text,text,text,text,jsonb,text);
create function public.create_self_order(p_tenant_slug text,p_customer_name text,p_customer_contact text,p_payment_method text,p_items jsonb,p_payment_reference text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_tenant public.tenants%rowtype; v_settings jsonb; v_item jsonb; v_product public.products%rowtype; v_qty numeric; v_total numeric(14,2):=0; v_id uuid; v_no text; v_token uuid;
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
 returning id,payment_proof_token into v_id,v_token;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and tenant_id=v_tenant.id;
  insert into public.self_order_items(self_order_id,product_id,product_name_snapshot,quantity,unit_price,item_note)
  values(v_id,v_product.id,v_product.name,v_qty,v_product.sale_price,nullif(v_item->>'note',''));
 end loop;
 return jsonb_build_object('order_id',v_id,'order_number',v_no,'proof_token',v_token);
end;
$$;
grant execute on function public.create_self_order(text,text,text,text,jsonb,text) to anon,authenticated;

create or replace function public.set_self_order_payment_proof(p_order_id uuid,p_proof_token uuid,p_path text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_order public.self_orders%rowtype; v_expected text;
begin
 select * into v_order from public.self_orders where id=p_order_id for update;
 if not found or v_order.payment_proof_token<>p_proof_token or v_order.payment_status<>'submitted' then raise exception 'Pesanan atau token bukti pembayaran tidak valid'; end if;
 v_expected:=v_order.tenant_id::text||'/'||v_order.id::text||'/'||v_order.payment_proof_token::text||'/';
 if left(p_path,length(v_expected))<>v_expected then raise exception 'Path bukti pembayaran tidak valid'; end if;
 update public.self_orders set payment_proof_path=p_path where id=v_order.id;
 return true;
end;
$$;
revoke all on function public.set_self_order_payment_proof(uuid,uuid,text) from public;
grant execute on function public.set_self_order_payment_proof(uuid,uuid,text) to anon,authenticated;
