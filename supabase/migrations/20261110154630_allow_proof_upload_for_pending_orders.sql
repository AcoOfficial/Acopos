
drop policy if exists self_order_proof_public_upload on storage.objects;
create policy self_order_proof_public_upload on storage.objects for insert to anon,authenticated
with check(
 bucket_id='self-order-payment-proofs'
 and array_length(storage.foldername(name),1)>=3
 and exists(
  select 1 from public.self_orders so
  where so.tenant_id=(storage.foldername(name))[1]::uuid
   and so.id=(storage.foldername(name))[2]::uuid
   and so.payment_proof_token=(storage.foldername(name))[3]::uuid
   and so.payment_status='pending'
   and so.payment_method in ('transfer','qris')
 )
);
