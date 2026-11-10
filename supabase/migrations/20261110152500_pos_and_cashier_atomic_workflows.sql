
create unique index if not exists cashier_one_open_session_per_register on public.cashier_sessions(register_id) where status='open';
create or replace function private.open_cashier_session(p_tenant_id uuid,p_register_id uuid,p_opening_float numeric) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_number bigint;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_opening_float is null or p_opening_float<0 then raise exception 'Opening float must be zero or greater'; end if;
 if not private.has_tenant_permission(p_tenant_id,'cashier.open') then raise exception 'You do not have permission or the Company subscription is inactive'; end if;
 if not exists(select 1 from public.registers r where r.id=p_register_id and r.tenant_id=p_tenant_id and r.is_active) then raise exception 'Register is not active for this Tenant'; end if;
 perform 1 from public.cashier_sessions where register_id=p_register_id and status='open' for update;
 if found then raise exception 'This register already has an open cashier session'; end if;
 select coalesce(max(session_number),0)+1 into v_number from public.cashier_sessions where tenant_id=p_tenant_id;
 insert into public.cashier_sessions(tenant_id,register_id,session_number,opened_by,opening_float,status) values(p_tenant_id,p_register_id,v_number,(select auth.uid()),p_opening_float,'open') returning id into v_id;
 return v_id;
end; $$;
revoke all on function private.open_cashier_session(uuid,uuid,numeric) from public;
grant execute on function private.open_cashier_session(uuid,uuid,numeric) to authenticated;
create or replace function private.complete_pos_sale(p_tenant_id uuid,p_register_id uuid,p_session_id uuid,p_items jsonb,p_payments jsonb,p_order_note text default null,p_discount numeric default 0,p_tax numeric default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_session public.cashier_sessions%rowtype; v_tx uuid; v_number text; v_subtotal numeric(14,2):=0; v_discount numeric(14,2):=greatest(coalesce(p_discount,0),0); v_tax numeric(14,2):=greatest(coalesce(p_tax,0),0); v_total numeric(14,2); v_paid numeric(14,2):=0; v_item jsonb; v_payment jsonb; v_product public.products%rowtype; v_qty numeric(14,3); v_line numeric(14,2); v_before numeric(14,3);
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
 for v_payment in select value from jsonb_array_elements(p_payments) loop
  if (v_payment->>'amount')::numeric<0 then raise exception 'Payment amount cannot be negative'; end if;
  if v_payment->>'method' not in ('cash','transfer','qris','other') then raise exception 'Unsupported payment method'; end if;
  v_paid:=v_paid+(v_payment->>'amount')::numeric;
 end loop;
 if round(v_paid,2)<>round(v_total,2) then raise exception 'Payment total must equal transaction total'; end if;
 v_number:='TRX-'||to_char(clock_timestamp() at time zone 'Asia/Jakarta','YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.sales_transactions(tenant_id,cashier_session_id,transaction_number,cashier_id,status,subtotal,discount_total,tax_total,grand_total,order_note)
 values(p_tenant_id,p_session_id,v_number,v_uid,'completed',v_subtotal,v_discount,v_tax,v_total,nullif(p_order_note,'')) returning id into v_tx;
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
  insert into public.transaction_payments(transaction_id,payment_method,amount,payment_reference) values(v_tx,v_payment->>'method',(v_payment->>'amount')::numeric,nullif(v_payment->>'reference',''));
 end loop;
 return v_tx;
end; $$;
revoke all on function private.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric) from public;
grant execute on function private.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric) to authenticated;
create or replace function private.calculate_cashier_closing_totals() returns trigger language plpgsql set search_path='' as $$
declare v_session public.cashier_sessions%rowtype; v_cash numeric(14,2); v_transfer numeric(14,2); v_qris numeric(14,2);
begin
 select * into v_session from public.cashier_sessions where id=new.session_id for update;
 if not found or v_session.status<>'open' then raise exception 'Cashier session is not open'; end if;
 if v_session.opened_by<>(select auth.uid()) then raise exception 'Only the employee who opened this session may close it'; end if;
 select coalesce(sum(case when p.payment_method='cash' then p.amount else 0 end),0),coalesce(sum(case when p.payment_method='transfer' then p.amount else 0 end),0),coalesce(sum(case when p.payment_method='qris' then p.amount else 0 end),0) into v_cash,v_transfer,v_qris from public.transaction_payments p join public.sales_transactions t on t.id=p.transaction_id where t.cashier_session_id=new.session_id and t.status='completed';
 new.system_cash:=v_session.opening_float+v_cash; new.system_transfer:=v_transfer; new.system_qris:=v_qris;
 new.difference_cash:=new.actual_cash-new.system_cash; new.difference_transfer:=new.actual_transfer-new.system_transfer; new.difference_qris:=new.actual_qris-new.system_qris;
 new.confirmed_by:=(select auth.uid()); new.confirmed_at:=clock_timestamp(); return new;
end; $$;
