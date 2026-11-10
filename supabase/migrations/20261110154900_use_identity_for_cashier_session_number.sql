
create or replace function private.open_cashier_session(p_tenant_id uuid,p_register_id uuid,p_opening_float numeric)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_opening_float is null or p_opening_float<0 then raise exception 'Opening float must be zero or greater'; end if;
 if not private.has_tenant_permission(p_tenant_id,'cashier.open') then raise exception 'You do not have permission or the Company subscription is inactive'; end if;
 if not exists(select 1 from public.registers r where r.id=p_register_id and r.tenant_id=p_tenant_id and r.is_active) then raise exception 'Register is not active for this Tenant'; end if;
 perform 1 from public.cashier_sessions where register_id=p_register_id and status='open' for update;
 if found then raise exception 'This register already has an open cashier session'; end if;
 insert into public.cashier_sessions(tenant_id,register_id,opened_by,opening_float,status)
 values(p_tenant_id,p_register_id,(select auth.uid()),p_opening_float,'open')
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function private.open_cashier_session(uuid,uuid,numeric) from public;
grant execute on function private.open_cashier_session(uuid,uuid,numeric) to authenticated;
