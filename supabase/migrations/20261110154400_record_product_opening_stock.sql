
create or replace function private.record_product_opening_stock()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.stock_quantity>0 then
  insert into public.inventory_movements(tenant_id,product_id,movement_type,quantity,before_quantity,after_quantity,reason,actor_id)
  values(new.tenant_id,new.id,'opening',new.stock_quantity,0,new.stock_quantity,'Stok awal saat produk dibuat',(select auth.uid()));
 end if;
 return new;
end;
$$;
revoke all on function private.record_product_opening_stock() from public;
drop trigger if exists products_record_opening_stock on public.products;
create trigger products_record_opening_stock after insert on public.products for each row execute function private.record_product_opening_stock();
