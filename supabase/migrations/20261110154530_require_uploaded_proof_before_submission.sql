
create or replace function public.set_self_order_payment_proof(p_order_id uuid,p_proof_token uuid,p_path text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_order public.self_orders%rowtype; v_expected text;
begin
 select * into v_order from public.self_orders where id=p_order_id for update;
 if not found or v_order.payment_proof_token<>p_proof_token or v_order.payment_status<>'pending' or v_order.payment_method not in ('transfer','qris') then raise exception 'Pesanan atau token bukti pembayaran tidak valid'; end if;
 v_expected:=v_order.tenant_id::text||'/'||v_order.id::text||'/'||v_order.payment_proof_token::text||'/';
 if left(p_path,length(v_expected))<>v_expected then raise exception 'Path bukti pembayaran tidak valid'; end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='self-order-payment-proofs' and o.name=p_path) then raise exception 'File bukti pembayaran belum diunggah'; end if;
 update public.self_orders set payment_proof_path=p_path,payment_status='submitted' where id=v_order.id;
 return true;
end;
$$;
revoke all on function public.set_self_order_payment_proof(uuid,uuid,text) from public;
grant execute on function public.set_self_order_payment_proof(uuid,uuid,text) to anon,authenticated;
revoke all on function public.create_self_order(text,text,text,text,jsonb,text) from public;
grant execute on function public.create_self_order(text,text,text,text,jsonb,text) to anon,authenticated;
