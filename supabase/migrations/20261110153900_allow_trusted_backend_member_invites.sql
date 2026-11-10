
create or replace function private.guard_tenant_member_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_tenant_id uuid; v_is_owner boolean;
begin
 if (select auth.role())='service_role' then
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 v_tenant_id:=case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
 v_is_owner:=private.is_active_tenant_owner(v_tenant_id);
 if v_is_owner then if tg_op='DELETE' then return old; else return new; end if; end if;
 if not private.has_tenant_permission(v_tenant_id,'employees.manage') then raise exception 'Not authorized to manage Tenant members' using errcode='42501'; end if;
 if tg_op='INSERT' then
  if new.role<>'employee' then raise exception 'Only the Company Owner may assign a Tenant Manager' using errcode='42501'; end if;
  return new;
 elsif tg_op='UPDATE' then
  if old.role<>'employee' or new.role<>'employee' or new.user_id<>old.user_id or new.tenant_id<>old.tenant_id then
   raise exception 'Managers may only update existing employee records and cannot promote or reassign users' using errcode='42501';
  end if;
  return new;
 elsif tg_op='DELETE' then
  if old.role<>'employee' then raise exception 'Managers may only remove employees, not other managers' using errcode='42501'; end if;
  return old;
 end if;
 return null;
end;
$$;
