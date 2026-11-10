create or replace function public.close_cashier_session(
  p_session_id uuid,
  p_actual_cash numeric,
  p_actual_transfer numeric,
  p_actual_qris numeric,
  p_explanation text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_session public.cashier_sessions%rowtype;
  v_closing_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if p_actual_cash is null or p_actual_transfer is null or p_actual_qris is null
     or p_actual_cash < 0 or p_actual_transfer < 0 or p_actual_qris < 0 then
    raise exception 'Actual payment balances must be zero or greater';
  end if;

  select * into v_session
  from public.cashier_sessions
  where id = p_session_id
  for update;

  if not found then raise exception 'Cashier session not found'; end if;
  if v_session.status <> 'open' then raise exception 'Cashier session is already closed'; end if;
  if v_session.opened_by <> (select auth.uid()) then
    raise exception 'Only the employee who opened this session may close it';
  end if;

  insert into public.cashier_session_closings(
    session_id, actual_cash, actual_transfer, actual_qris, confirmed_by, explanation
  )
  values (
    p_session_id, p_actual_cash, p_actual_transfer, p_actual_qris, (select auth.uid()), nullif(trim(p_explanation), '')
  )
  returning id into v_closing_id;

  update public.cashier_sessions
  set status = 'closed', closed_by = (select auth.uid())
  where id = p_session_id and status = 'open';

  if not found then raise exception 'Cashier session could not be closed'; end if;
  return v_closing_id;
end;
$function$;

revoke all on function public.close_cashier_session(uuid,numeric,numeric,numeric,text) from public, anon;
grant execute on function public.close_cashier_session(uuid,numeric,numeric,numeric,text) to authenticated;
