
alter table public.self_orders add column if not exists stock_deducted_at timestamptz;

create or replace function private.process_self_order(p_tenant_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_order public.self_orders%rowtype; v_item record; v_product public.products%rowtype; v_before numeric(14,3);
begin
 if not private.has_tenant_permission(p_tenant_id,'self_order.manage') then raise exception 'Self Order permission or active subscription required'; end if;
 if p_new_status not in ('processing','ready','completed','cancelled') then raise exception 'Invalid order status'; end if;
 select * into v_order from public.self_orders where id=p_order_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Self Order not found'; end if;
 if p_new_status in ('processing','ready','completed') and v_order.payment_status<>'approved' then raise exception 'Payment must be approved before processing this order'; end if;
 if p_new_status='processing' and v_order.order_status='received' and v_order.stock_deducted_at is null then
  for v_item in select * from public.self_order_items where self_order_id=v_order.id loop
   select * into v_product from public.products where id=v_item.product_id and tenant_id=p_tenant_id for update;
   if not found or v_product.stock_quantity<v_item.quantity then raise exception 'Insufficient stock for Self Order item %',v_item.product_name_snapshot; end if;
   v_before:=v_product.stock_quantity;
   update public.products set stock_quantity=stock_quantity-v_item.quantity,updated_at=clock_timestamp() where id=v_product.id;
   insert into public.inventory_movements(tenant_id,product_id,movement_type,quantity,before_quantity,after_quantity,reason,reference_id,actor_id)
   values(p_tenant_id,v_product.id,'sale',v_item.quantity,v_before,v_before-v_item.quantity,'Self Order '||v_order.order_number,v_order.id,(select auth.uid()));
  end loop;
  update public.self_orders set order_status='processing',stock_deducted_at=clock_timestamp() where id=v_order.id;
 elsif p_new_status='ready' then
  if v_order.order_status not in ('processing','ready') then raise exception 'Order must be processing before marked ready'; end if;
  update public.self_orders set order_status='ready' where id=v_order.id;
 elsif p_new_status='completed' then
  if v_order.order_status not in ('processing','ready','completed') then raise exception 'Order must be processing before completion'; end if;
  update public.self_orders set order_status='completed' where id=v_order.id;
 elsif p_new_status='cancelled' then
  if v_order.stock_deducted_at is not null then raise exception 'Processed order cannot be cancelled directly; use a controlled return/refund workflow'; end if;
  update public.self_orders set order_status='cancelled' where id=v_order.id;
 elsif p_new_status='processing' then
  if v_order.order_status not in ('processing','ready') then raise exception 'Invalid order transition'; end if;
 end if;
 return jsonb_build_object('order_id',v_order.id,'order_status',p_new_status,'stock_deducted',p_new_status='processing' and v_order.stock_deducted_at is null);
end;
$$;
grant execute on function private.process_self_order(uuid,uuid,text) to authenticated;
create or replace function public.process_self_order(p_tenant_id uuid,p_order_id uuid,p_new_status text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.process_self_order(p_tenant_id,p_order_id,p_new_status); $$;
grant execute on function public.process_self_order(uuid,uuid,text) to authenticated;
