
create or replace function public.can_upload_self_order_payment_proof(p_tenant_id uuid,p_order_id uuid,p_token uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(
  select 1 from public.self_orders so
  where so.tenant_id=p_tenant_id and so.id=p_order_id and so.payment_proof_token=p_token
   and so.payment_status='pending' and so.payment_method in ('transfer','qris')
 );
$$;
revoke all on function public.can_upload_self_order_payment_proof(uuid,uuid,uuid) from public;
grant execute on function public.can_upload_self_order_payment_proof(uuid,uuid,uuid) to anon,authenticated;

drop policy if exists self_order_proof_public_upload on storage.objects;
create policy self_order_proof_public_upload on storage.objects for insert to anon,authenticated
with check(
 bucket_id='self-order-payment-proofs'
 and array_length(storage.foldername(name),1)>=3
 and public.can_upload_self_order_payment_proof(
  (storage.foldername(name))[1]::uuid,
  (storage.foldername(name))[2]::uuid,
  (storage.foldername(name))[3]::uuid
 )
);
