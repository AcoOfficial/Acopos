
grant usage on schema private to anon,authenticated;

alter function public.redeem_owner_activation(text,text,text) set schema private;
alter function public.get_self_order_catalog(text) set schema private;
alter function public.create_self_order(text,text,text,text,jsonb,text) set schema private;
alter function public.set_self_order_payment_proof(uuid,uuid,text) set schema private;
alter function public.can_upload_self_order_payment_proof(uuid,uuid,uuid) set schema private;
alter function public.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric,uuid) set schema private;
alter function private.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric,uuid) rename to complete_pos_sale_with_customer;
alter function public.create_queue_ticket(uuid,text,text) set schema private;

grant execute on function private.redeem_owner_activation(text,text,text) to authenticated;
grant execute on function private.get_self_order_catalog(text) to anon,authenticated;
grant execute on function private.create_self_order(text,text,text,text,jsonb,text) to anon,authenticated;
grant execute on function private.set_self_order_payment_proof(uuid,uuid,text) to anon,authenticated;
grant execute on function private.can_upload_self_order_payment_proof(uuid,uuid,uuid) to anon,authenticated;
grant execute on function private.complete_pos_sale_with_customer(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric,uuid) to authenticated;
grant execute on function private.create_queue_ticket(uuid,text,text) to authenticated;

create or replace function public.redeem_owner_activation(p_code_hash text,p_company_name text,p_tenant_name text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.redeem_owner_activation(p_code_hash,p_company_name,p_tenant_name); $$;
grant execute on function public.redeem_owner_activation(text,text,text) to authenticated;

create or replace function public.get_self_order_catalog(p_tenant_slug text)
returns jsonb language sql security invoker set search_path=''
as $$ select private.get_self_order_catalog(p_tenant_slug); $$;
grant execute on function public.get_self_order_catalog(text) to anon,authenticated;

create or replace function public.create_self_order(p_tenant_slug text,p_customer_name text,p_customer_contact text,p_payment_method text,p_items jsonb,p_payment_reference text default null)
returns jsonb language sql security invoker set search_path=''
as $$ select private.create_self_order(p_tenant_slug,p_customer_name,p_customer_contact,p_payment_method,p_items,p_payment_reference); $$;
grant execute on function public.create_self_order(text,text,text,text,jsonb,text) to anon,authenticated;

create or replace function public.set_self_order_payment_proof(p_order_id uuid,p_proof_token uuid,p_path text)
returns boolean language sql security invoker set search_path=''
as $$ select private.set_self_order_payment_proof(p_order_id,p_proof_token,p_path); $$;
grant execute on function public.set_self_order_payment_proof(uuid,uuid,text) to anon,authenticated;

create or replace function public.complete_pos_sale(p_tenant_id uuid,p_register_id uuid,p_session_id uuid,p_items jsonb,p_payments jsonb,p_order_note text default null,p_discount numeric default 0,p_tax numeric default 0,p_customer_id uuid default null)
returns uuid language sql security invoker set search_path=''
as $$ select private.complete_pos_sale_with_customer(p_tenant_id,p_register_id,p_session_id,p_items,p_payments,p_order_note,p_discount,p_tax,p_customer_id); $$;
grant execute on function public.complete_pos_sale(uuid,uuid,uuid,jsonb,jsonb,text,numeric,numeric,uuid) to authenticated;

create or replace function public.create_queue_ticket(p_tenant_id uuid,p_customer_name text default null,p_counter_name text default null)
returns public.queue_tickets language sql security invoker set search_path=''
as $$ select private.create_queue_ticket(p_tenant_id,p_customer_name,p_counter_name); $$;
grant execute on function public.create_queue_ticket(uuid,text,text) to authenticated;

drop policy if exists self_order_proof_public_upload on storage.objects;
create policy self_order_proof_public_upload on storage.objects for insert to anon,authenticated
with check(
 bucket_id='self-order-payment-proofs'
 and array_length(storage.foldername(name),1)>=3
 and private.can_upload_self_order_payment_proof(
  (storage.foldername(name))[1]::uuid,
  (storage.foldername(name))[2]::uuid,
  (storage.foldername(name))[3]::uuid
 )
);
drop policy if exists queue_daily_counters_deny_client on public.queue_daily_counters;
create policy queue_daily_counters_deny_client on public.queue_daily_counters for all to anon,authenticated using(false) with check(false);
