
create or replace function public.create_queue_ticket(p_tenant_id uuid,p_customer_name text default null,p_counter_name text default null)
returns public.queue_tickets language plpgsql security definer set search_path=''
as $$
declare v_number integer; v_prefix text; v_settings jsonb; v_ticket public.queue_tickets%rowtype;
begin
 if not private.has_tenant_permission(p_tenant_id,'queue.manage') then raise exception 'Queue permission or active subscription required'; end if;
 select settings into v_settings from public.tenant_settings where tenant_id=p_tenant_id;
 if coalesce((v_settings#>>'{queue,enabled}')::boolean,false)=false then raise exception 'Modul antrean belum diaktifkan pada Pengaturan Tenant'; end if;
 insert into public.queue_daily_counters(tenant_id,queue_date,last_number) values(p_tenant_id,(clock_timestamp() at time zone 'Asia/Jakarta')::date,1)
 on conflict(tenant_id,queue_date) do update set last_number=public.queue_daily_counters.last_number+1
 returning last_number into v_number;
 v_prefix:=coalesce(nullif(v_settings#>>'{queue,prefix}',''),'A');
 insert into public.queue_tickets(tenant_id,ticket_number,customer_name,counter_name,status)
 values(p_tenant_id,v_prefix||to_char((clock_timestamp() at time zone 'Asia/Jakarta')::date,'YYMMDD')||lpad(v_number::text,3,'0'),nullif(p_customer_name,''),nullif(p_counter_name,''),'waiting')
 returning * into v_ticket;
 return v_ticket;
end;
$$;
revoke all on function public.create_queue_ticket(uuid,text,text) from public,anon;
grant execute on function public.create_queue_ticket(uuid,text,text) to authenticated;
