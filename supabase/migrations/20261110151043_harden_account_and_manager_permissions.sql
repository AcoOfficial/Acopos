-- Harden profile self-service, Tenant membership hierarchy, and manager delegation.
create or replace function private.has_company_access(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.companies c join public.profiles p on p.id=(select auth.uid())
    where c.id=p_company_id and c.owner_user_id=(select auth.uid())
      and c.status <> 'suspended' and p.account_status='active'
  ) or exists (
    select 1 from public.company_members cm join public.companies c on c.id=cm.company_id
    join public.profiles p on p.id=cm.user_id
    where cm.company_id=p_company_id and cm.user_id=(select auth.uid())
      and cm.is_active and c.status <> 'suspended' and p.account_status='active'
  );
$$;

create or replace function private.is_company_owner(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.companies c join public.profiles p on p.id=(select auth.uid())
    where c.id=p_company_id and c.owner_user_id=(select auth.uid())
      and c.status <> 'suspended' and p.account_status='active'
  );
$$;

create or replace function private.has_tenant_access(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenants t join public.companies c on c.id=t.company_id
    join public.profiles p on p.id=(select auth.uid())
    where t.id=p_tenant_id and c.owner_user_id=(select auth.uid())
      and c.status <> 'suspended' and p.account_status='active'
  ) or exists (
    select 1 from public.tenant_members tm join public.tenants t on t.id=tm.tenant_id
    join public.companies c on c.id=t.company_id join public.profiles p on p.id=tm.user_id
    where tm.tenant_id=p_tenant_id and tm.user_id=(select auth.uid())
      and tm.is_active and c.status <> 'suspended' and p.account_status='active'
  );
$$;

create or replace function private.is_active_tenant_owner(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tenants t join public.companies c on c.id=t.company_id
    join public.profiles p on p.id=(select auth.uid())
    join public.company_subscriptions s on s.company_id=c.id
    where t.id=p_tenant_id and c.owner_user_id=(select auth.uid())
      and t.status='active' and c.status='active' and p.account_status='active'
      and s.status='active' and s.starts_at <= now() and s.ends_at > now()
  );
$$;

create or replace function private.can_manage_tenant_member(p_tenant_id uuid,p_role text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.is_active_tenant_owner(p_tenant_id)
    or (p_role='employee' and private.has_tenant_permission(p_tenant_id,'employees.manage'));
$$;

create or replace function private.guard_tenant_member_mutation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_tenant_id uuid; v_is_owner boolean;
begin
  v_tenant_id := case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
  v_is_owner := private.is_active_tenant_owner(v_tenant_id);
  if v_is_owner then if tg_op='DELETE' then return old; else return new; end if;
  if not private.has_tenant_permission(v_tenant_id,'employees.manage') then
    raise exception 'Not authorized to manage Tenant members' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if new.role <> 'employee' then raise exception 'Only the Company Owner may assign a Tenant Manager' using errcode='42501'; end if;
    return new;
  elsif tg_op='UPDATE' then
    if old.role <> 'employee' or new.role <> 'employee' or new.user_id <> old.user_id or new.tenant_id <> old.tenant_id then
      raise exception 'Managers may only update existing employee records and cannot promote or reassign users' using errcode='42501';
    end if;
    return new;
  elsif tg_op='DELETE' then
    if old.role <> 'employee' then raise exception 'Managers may only remove employees, not other managers' using errcode='42501'; end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists guard_tenant_member_mutation on public.tenant_members;
create trigger guard_tenant_member_mutation before insert or update or delete on public.tenant_members
for each row execute function private.guard_tenant_member_mutation();

drop policy tenant_members_insert_manage on public.tenant_members;
drop policy tenant_members_update_manage on public.tenant_members;
drop policy tenant_members_delete_manage on public.tenant_members;
create policy tenant_members_insert_manage on public.tenant_members for insert to authenticated
with check (private.can_manage_tenant_member(tenant_id,role));
create policy tenant_members_update_manage on public.tenant_members for update to authenticated
using (private.has_tenant_permission(tenant_id,'employees.manage'))
with check (private.can_manage_tenant_member(tenant_id,role));
create policy tenant_members_delete_manage on public.tenant_members for delete to authenticated
using (private.has_tenant_permission(tenant_id,'employees.manage'));

drop policy tenant_permissions_insert_manage on public.tenant_member_permissions;
drop policy tenant_permissions_update_manage on public.tenant_member_permissions;
drop policy tenant_permissions_delete_manage on public.tenant_member_permissions;
create policy tenant_permissions_insert_owner on public.tenant_member_permissions for insert to authenticated
with check (private.is_active_tenant_owner(tenant_id));
create policy tenant_permissions_update_owner on public.tenant_member_permissions for update to authenticated
using (private.is_active_tenant_owner(tenant_id))
with check (private.is_active_tenant_owner(tenant_id));
create policy tenant_permissions_delete_owner on public.tenant_member_permissions for delete to authenticated
using (private.is_active_tenant_owner(tenant_id));

revoke update, insert on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
revoke execute on function private.handle_new_user() from public, authenticated;
revoke execute on function private.record_cashier_attendance() from public, authenticated;
revoke execute on function private.guard_tenant_member_mutation() from public, authenticated;
