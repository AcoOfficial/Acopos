
alter table public.sales_transactions add column if not exists cash_received numeric(14,2) not null default 0;
alter table public.sales_transactions add column if not exists change_due numeric(14,2) not null default 0;

create or replace function private.complete_pos_sale(
 p_tenant_id uuid,p_register_id uuid,p_session_id uuid,p_items jsonb,p_payments jsonb,
 p_order_note text default null,p_discount numeric default 0,p_tax numeric default 0
) returns uuid language plpgsql security definer set search_path=''
as $$
declare
 v_uid uuid:=(select auth.uid()); v_session public.cashier_sessions%rowtype; v_tx uuid; v_number text;
 v_subtotal numeric(14,2):=0; v_discount numeric(14,2):=greatest(coalesce(p_discount,0),0); v_tax numeric(14,2):=greatest(coalesce(p_tax,0),0);
 v_total numeric(14,2); v_paid numeric(14,2):=0; v_cash_received numeric(14,2):=0; v_change numeric(14,2):=0;
 v_item jsonb; v_payment jsonb; v_product public.products%rowtype; v_qty numeric(14,3); v_line numeric(14,2); v_before numeric(14,3);
 v_cash_count integer:=0; v_payment_count integer:=0;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if not private.has_tenant_permission(p_tenant_id,'pos.use') then raise exception 'POS permission or active subscription required'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
 if jsonb_typeof(p_payments)<>'array' or jsonb_array_length(p_payments)=0 then raise exception 'Payment is required'; end if;
 select * into v_session from public.cashier_sessions where id=p_session_id and tenant_id=p_tenant_id and register_id=p_register_id and status='open' and opened_by=v_uid for update;
 if not found then raise exception 'An open cashier session belonging to this employee is required'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric; if v_qty<=0 then raise exception 'Invalid item quantity'; end if;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and tenant_id=p_tenant_id and is_active for update;
  if not found then raise exception 'Product not found or inactive'; end if;
  if v_product.stock_quantity<v_qty then raise exception 'Insufficient stock for %',v_product.name; end if;
  v_line:=round(v_product.sale_price*v_qty,2); v_subtotal:=v_subtotal+v_line;
 end loop;
 v_total:=greatest(v_subtotal-v_discount+v_tax,0);
 select count(*) into v_payment_count from jsonb_array_elements(p_payments);
 for v_payment in select value from jsonb_array_elements(p_payments) loop
  if (v_payment->>'amount')::numeric<0 then raise exception 'Payment amount cannot be negative'; end if;
  if v_payment->>'method' not in ('cash','transfer','qris','other') then raise exception 'Unsupported payment method'; end if;
  v_paid:=v_paid+(v_payment->>'amount')::numeric;
  if v_payment->>'method'='cash' then
   v_cash_count:=v_cash_count+1;
   v_cash_received:=coalesce(nullif(v_payment->>'received','')::numeric,(v_payment->>'amount')::numeric);
  end if;
 end loop;
 if round(v_paid,2)<>round(v_total,2) then raise exception 'Applied payment total must equal transaction total'; end if;
 if v_cash_count>1 then raise exception 'Cash tender must be supplied in one payment line'; end if;
 if v_cash_count=1 then
  if v_payment_count<>1 then raise exception 'Cash tender cannot be mixed with other methods in this checkout'; end if;
  if v_cash_received<v_total then raise exception 'Cash received is less than transaction total'; end if;
  v_change:=v_cash_received-v_total;
 end if;
 v_number:='TRX-'||to_char(clock_timestamp() at time zone 'Asia/Jakarta','YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.sales_transactions(tenant_id,cashier_session_id,transaction_number,cashier_id,status,subtotal,discount_total,tax_total,grand_total,order_note,cash_received,change_due)
 values(p_tenant_id,p_session_id,v_number,v_uid,'completed',v_subtotal,v_discount,v_tax,v_total,nullif(p_order_note,''),v_cash_received,v_change)
 returning id into v_tx;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::numeric;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and tenant_id=p_tenant_id for update;
  v_line:=round(v_product.sale_price*v_qty,2);
  insert into public.transaction_items(transaction_id,product_id,product_name_snapshot,quantity,unit_price,cost_price_snapshot,discount_amount,line_total,item_note)
  values(v_tx,v_product.id,v_product.name,v_qty,v_product.sale_price,v_product.cost_price,0,v_line,nullif(v_item->>'note',''));
  v_before:=v_product.stock_quantity;
  update public.products set stock_quantity=stock_quantity-v_qty,updated_at=clock_timestamp() where id=v_product.id;
  insert into public.inventory_movements(tenant_id,product_id,movement_type,quantity,before_quantity,after_quantity,reason,reference_id,actor_id)
  values(p_tenant_id,v_product.id,'sale',v_qty,v_before,v_before-v_qty,'Penjualan POS',v_tx,v_uid);
 end loop;
 for v_payment in select value from jsonb_array_elements(p_payments) loop
  insert into public.transaction_payments(transaction_id,payment_method,amount,payment_reference)
  values(v_tx,v_payment->>'method',(v_payment->>'amount')::numeric,nullif(v_payment->>'reference',''));
 end loop;
 return v_tx;
end;
$$;
revoke all on function private.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric) from public;
grant execute on function private.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric) to authenticated;
