
create or replace function public.redeem_owner_activation(p_code_hash text,p_company_name text,p_tenant_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_code public.activation_codes%rowtype; v_company uuid; v_tenant uuid; v_company_slug text; v_tenant_slug text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 if nullif(trim(p_company_name),'') is null or nullif(trim(p_tenant_name),'') is null then raise exception 'Company and Tenant names are required'; end if;
 select * into v_code from public.activation_codes where code_hash=p_code_hash and status='available' and (expires_at is null or expires_at>clock_timestamp()) for update;
 if not found then raise exception 'Activation code is invalid, expired, or already used'; end if;
 if exists(select 1 from public.companies where owner_user_id=v_uid) then raise exception 'This account already owns a Company'; end if;
 v_company_slug:=trim(both '-' from regexp_replace(lower(p_company_name),'[^a-z0-9]+','-','g'))||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
 v_tenant_slug:=trim(both '-' from regexp_replace(lower(p_tenant_name),'[^a-z0-9]+','-','g'))||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
 insert into public.companies(name,slug,owner_user_id,status) values(trim(p_company_name),v_company_slug,v_uid,'active') returning id into v_company;
 insert into public.company_members(company_id,user_id,role,is_active) values(v_company,v_uid,'owner',true);
 insert into public.tenants(company_id,name,slug,status) values(v_company,trim(p_tenant_name),v_tenant_slug,'active') returning id into v_tenant;
 update public.activation_codes set status='redeemed',redeemed_by=v_uid,redeemed_at=clock_timestamp() where id=v_code.id;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,after_data) values(v_company,v_uid,'owner.registration','company',v_company,jsonb_build_object('company_name',trim(p_company_name),'main_tenant_id',v_tenant));
 return jsonb_build_object('company_id',v_company,'tenant_id',v_tenant);
end; $$;
revoke all on function public.redeem_owner_activation(text,text,text) from public;
grant execute on function public.redeem_owner_activation(text,text,text) to authenticated;
create or replace function private.adjust_product_stock(p_tenant_id uuid,p_product_id uuid,p_quantity numeric,p_movement_type text,p_reason text) returns numeric language plpgsql security definer set search_path='' as $$
declare v_product public.products%rowtype; v_after numeric(14,3);
begin
 if not private.has_tenant_permission(p_tenant_id,'inventory.manage') then raise exception 'Inventory permission or active subscription required'; end if;
 if p_quantity is null or p_quantity<=0 or p_movement_type not in ('in','out','adjustment') then raise exception 'Invalid stock movement'; end if;
 select * into v_product from public.products where id=p_product_id and tenant_id=p_tenant_id for update;
 if not found then raise exception 'Product not found'; end if;
 if p_movement_type='in' then v_after:=v_product.stock_quantity+p_quantity; elsif p_movement_type='out' then v_after:=v_product.stock_quantity-p_quantity; else v_after:=p_quantity; end if;
 if v_after<0 then raise exception 'Stock cannot be negative'; end if;
 update public.products set stock_quantity=v_after,updated_at=clock_timestamp() where id=p_product_id;
 insert into public.inventory_movements(tenant_id,product_id,movement_type,quantity,before_quantity,after_quantity,reason,actor_id) values(p_tenant_id,p_product_id,p_movement_type,p_quantity,v_product.stock_quantity,v_after,nullif(p_reason,''),(select auth.uid()));
 return v_after;
end; $$;
revoke all on function private.adjust_product_stock(uuid,uuid,numeric,text,text) from public;
grant execute on function private.adjust_product_stock(uuid,uuid,numeric,text,text) to authenticated;
