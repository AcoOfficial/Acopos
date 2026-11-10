
create table if not exists public.platform_settings(
 setting_key text primary key,
 setting_value jsonb not null default '{}'::jsonb,
 updated_by uuid references public.profiles(id),
 updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_read_staff on public.platform_settings;
create policy platform_settings_read_staff on public.platform_settings for select to authenticated using(private.is_platform_admin());
drop policy if exists platform_settings_superadmin_write on public.platform_settings;
create policy platform_settings_superadmin_write on public.platform_settings for all to authenticated using(private.is_super_admin()) with check(private.is_super_admin() and updated_by=(select auth.uid()));

alter table public.subscription_payment_requests add column if not exists payment_proof_token uuid default gen_random_uuid();
update public.subscription_payment_requests set payment_proof_token=gen_random_uuid() where payment_proof_token is null;
alter table public.subscription_payment_requests alter column payment_proof_token set not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('subscription-payment-proofs','subscription-payment-proofs',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

create or replace function private.can_upload_subscription_proof(p_company_id uuid,p_request_id uuid,p_token uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.subscription_payment_requests r where r.id=p_request_id and r.company_id=p_company_id and r.payment_proof_token=p_token and r.status='pending' and private.is_company_owner(r.company_id));
$$;
grant execute on function private.can_upload_subscription_proof(uuid,uuid,uuid) to authenticated;

drop policy if exists subscription_proof_owner_upload on storage.objects;
create policy subscription_proof_owner_upload on storage.objects for insert to authenticated
with check(bucket_id='subscription-payment-proofs' and array_length(storage.foldername(name),1)>=3 and private.can_upload_subscription_proof((storage.foldername(name))[1]::uuid,(storage.foldername(name))[2]::uuid,(storage.foldername(name))[3]::uuid));
drop policy if exists subscription_proof_staff_read on storage.objects;
create policy subscription_proof_staff_read on storage.objects for select to authenticated
using(bucket_id='subscription-payment-proofs' and array_length(storage.foldername(name),1)>=3 and (private.is_platform_admin() or private.is_company_owner((storage.foldername(name))[1]::uuid)));

create or replace function private.set_subscription_payment_proof(p_request_id uuid,p_token uuid,p_path text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_request public.subscription_payment_requests%rowtype; v_expected text;
begin
 select * into v_request from public.subscription_payment_requests where id=p_request_id for update;
 if not found or v_request.payment_proof_token<>p_token or v_request.status<>'pending' or not private.is_company_owner(v_request.company_id) then raise exception 'Permintaan pembayaran atau token tidak valid'; end if;
 v_expected:=v_request.company_id::text||'/'||v_request.id::text||'/'||v_request.payment_proof_token::text||'/';
 if left(p_path,length(v_expected))<>v_expected then raise exception 'Path bukti pembayaran tidak valid'; end if;
 if not exists(select 1 from storage.objects where bucket_id='subscription-payment-proofs' and name=p_path) then raise exception 'Bukti pembayaran belum diunggah'; end if;
 update public.subscription_payment_requests set proof_url=p_path where id=v_request.id;
 return true;
end;
$$;
grant execute on function private.set_subscription_payment_proof(uuid,uuid,text) to authenticated;
create or replace function public.set_subscription_payment_proof(p_request_id uuid,p_token uuid,p_path text)
returns boolean language sql security invoker set search_path=''
as $$ select private.set_subscription_payment_proof(p_request_id,p_token,p_path); $$;
grant execute on function public.set_subscription_payment_proof(uuid,uuid,text) to authenticated;

create or replace function public.review_subscription_payment(p_request_id uuid,p_decision text,p_actor_id uuid,p_note text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_request public.subscription_payment_requests%rowtype; v_package public.packages%rowtype; v_subscription_id uuid; v_now timestamptz:=clock_timestamp(); v_ends timestamptz;
begin
 if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
 if not exists(select 1 from public.profiles where id=p_actor_id and platform_role in ('super_admin','admin_platform') and account_status='active') then raise exception 'Platform administrator required'; end if;
 select * into v_request from public.subscription_payment_requests where id=p_request_id for update;
 if not found or v_request.status<>'pending' then raise exception 'Payment request not found or already reviewed'; end if;
 if p_decision='approved' and v_request.payment_method in ('bank_transfer','qris') and v_request.proof_url is null then raise exception 'Payment proof is required before approval'; end if;
 select * into v_package from public.packages where id=v_request.package_id and is_active;
 if not found then raise exception 'Subscription package is inactive'; end if;
 update public.subscription_payment_requests set status=p_decision,reviewed_by=p_actor_id,reviewed_at=v_now,review_note=nullif(p_note,'') where id=v_request.id;
 if p_decision='approved' then
  v_ends:=v_now+(v_package.duration_days||' days')::interval;
  select id into v_subscription_id from public.company_subscriptions where company_id=v_request.company_id for update;
  if v_subscription_id is null then
   insert into public.company_subscriptions(company_id,package_id,status,starts_at,ends_at,tenant_quota_snapshot) values(v_request.company_id,v_package.id,'active',v_now,v_ends,v_package.tenant_quota) returning id into v_subscription_id;
  else
   update public.company_subscriptions set package_id=v_package.id,status='active',starts_at=v_now,ends_at=v_ends,tenant_quota_snapshot=v_package.tenant_quota,updated_at=v_now where id=v_subscription_id;
  end if;
 end if;
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,after_data) values(v_request.company_id,p_actor_id,'subscription.payment_'||p_decision,'subscription_payment_request',v_request.id,jsonb_build_object('decision',p_decision,'review_note',p_note,'subscription_id',v_subscription_id));
 return jsonb_build_object('request_id',v_request.id,'status',p_decision,'subscription_id',v_subscription_id);
end;
$$;
revoke all on function public.review_subscription_payment(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.review_subscription_payment(uuid,text,uuid,text) to service_role;
