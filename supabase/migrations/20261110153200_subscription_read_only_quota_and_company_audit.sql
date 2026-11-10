
create or replace function private.has_tenant_permission(p_tenant_id uuid,p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.tenants t join public.companies c on c.id=t.company_id
  join public.company_subscriptions s on s.company_id=c.id
  where t.id=p_tenant_id and t.status='active' and c.status='active' and c.owner_user_id=(select auth.uid())
   and s.status='active' and s.starts_at<=now() and s.ends_at>now()
 ) or exists(
  select 1 from public.tenant_members tm join public.tenants t on t.id=tm.tenant_id
  join public.companies c on c.id=t.company_id join public.company_subscriptions s on s.company_id=c.id
  join public.tenant_member_permissions tp on tp.tenant_id=tm.tenant_id and tp.user_id=tm.user_id
  where tm.tenant_id=p_tenant_id and tm.user_id=(select auth.uid()) and tm.is_active
   and t.status='active' and c.status='active' and tp.permission_key=p_permission and tp.granted
   and s.status='active' and s.starts_at<=now() and s.ends_at>now()
 );
$$;

create or replace function private.enforce_company_tenant_quota()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_company public.companies%rowtype; v_count integer; v_quota integer;
begin
 select * into v_company from public.companies where id=new.company_id for update;
 if not found or v_company.status<>'active' then raise exception 'Company is not active'; end if;
 if v_company.owner_user_id is distinct from (select auth.uid()) then raise exception 'Only the Company Owner may add a Tenant'; end if;
 select count(*) into v_count from public.tenants where company_id=new.company_id;
 select tenant_quota_snapshot into v_quota from public.company_subscriptions
  where company_id=new.company_id and status='active' and starts_at<=now() and ends_at>now();
 if v_count=0 and coalesce(v_quota,0)=0 then return new; end if;
 if coalesce(v_quota,0)=0 then raise exception 'An active Company subscription is required to add another Tenant'; end if;
 if v_count>=v_quota then raise exception 'Company Tenant quota has been reached'; end if;
 return new;
end;
$$;
revoke all on function private.enforce_company_tenant_quota() from public;
drop trigger if exists tenants_enforce_company_quota on public.tenants;
create trigger tenants_enforce_company_quota before insert on public.tenants for each row execute function private.enforce_company_tenant_quota();

create or replace function private.audit_tenant_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_row jsonb; v_tenant uuid; v_company uuid; v_id uuid; v_action text;
begin
 v_row:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_tenant:=nullif(v_row->>'tenant_id','')::uuid;
 v_id:=nullif(v_row->>'id','')::uuid;
 if tg_table_name='companies' then v_company:=v_id;
 elsif tg_table_name='tenants' then v_company:=nullif(v_row->>'company_id','')::uuid; v_tenant:=v_id;
 elsif v_tenant is not null then select company_id into v_company from public.tenants where id=v_tenant; end if;
 v_action:=lower(tg_table_name)||'.'||lower(tg_op);
 insert into public.audit_logs(company_id,tenant_id,actor_id,action,entity_type,entity_id,before_data,after_data)
 values(v_company,v_tenant,(select auth.uid()),v_action,tg_table_name,v_id,
 case when tg_op='INSERT' then null else to_jsonb(old) end,
 case when tg_op='DELETE' then null else to_jsonb(new) end);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;
do $$
declare t text;
begin
 foreach t in array array['companies','tenants'] loop
  execute format('drop trigger if exists audit_%I_change on public.%I',t,t);
  execute format('create trigger audit_%I_change after insert or update or delete on public.%I for each row execute function private.audit_tenant_change()',t,t);
 end loop;
end $$;
