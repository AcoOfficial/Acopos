
create or replace function public.review_subscription_payment(p_request_id uuid,p_decision text,p_actor_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_request public.subscription_payment_requests%rowtype; v_package public.packages%rowtype; v_subscription_id uuid; v_now timestamptz:=clock_timestamp(); v_ends timestamptz;
begin
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 if not exists(select 1 from public.profiles where id=p_actor_id and platform_role in ('super_admin','admin_platform') and account_status='active') then raise exception 'Platform administrator required'; end if;
 select * into v_request from public.subscription_payment_requests where id=p_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'Payment request not found or already reviewed'; end if;
 select * into v_package from public.packages where id=v_request.package_id and is_active;
 if not found then raise exception 'Subscription package is inactive'; end if;
 update public.subscription_payment_requests set status=p_decision,reviewed_by=p_actor_id,reviewed_at=v_now,review_note=nullif(p_note,'') where id=v_request.id;
 if p_decision='approved' then
  v_ends:=v_now+(v_package.duration_days||' days')::interval;
  select id into v_subscription_id from public.company_subscriptions where company_id=v_request.company_id for update;
  if v_subscription_id is null then
   insert into public.company_subscriptions(company_id,package_id,status,starts_at,ends_at,tenant_quota_snapshot)
   values(v_request.company_id,v_package.id,'active',v_now,v_ends,v_package.tenant_quota) returning id into v_subscription_id;
  else
   update public.company_subscriptions set package_id=v_package.id,status='active',starts_at=v_now,ends_at=v_ends,tenant_quota_snapshot=v_package.tenant_quota,updated_at=v_now where id=v_subscription_id;
  end if;
 end if;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,after_data)
 values(v_request.company_id,p_actor_id,'subscription.payment_'||p_decision,'subscription_payment_request',v_request.id,jsonb_build_object('decision',p_decision,'review_note',p_note,'subscription_id',v_subscription_id));
 return jsonb_build_object('request_id',v_request.id,'status',p_decision,'subscription_id',v_subscription_id);
end;
$$;
revoke all on function public.review_subscription_payment(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_subscription_payment(uuid,text,uuid,text) to service_role;
