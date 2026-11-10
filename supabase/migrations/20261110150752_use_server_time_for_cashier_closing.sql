create or replace function private.calculate_cashier_closing_totals()
returns trigger language plpgsql set search_path = ''
as $$
declare v_session public.cashier_sessions%rowtype; v_cash numeric(14,2); v_transfer numeric(14,2); v_qris numeric(14,2);
begin
  select * into v_session from public.cashier_sessions where id=new.session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'Cashier session is not open' using errcode='23514'; end if;
  if v_session.opened_by <> (select auth.uid()) then raise exception 'Only the account that opened this session may close it' using errcode='23514'; end if;
  select coalesce(sum(case when p.payment_method='cash' then p.amount else 0 end),0),
         coalesce(sum(case when p.payment_method='transfer' then p.amount else 0 end),0),
         coalesce(sum(case when p.payment_method='qris' then p.amount else 0 end),0)
    into v_cash,v_transfer,v_qris
    from public.transaction_payments p join public.sales_transactions t on t.id=p.transaction_id
   where t.cashier_session_id=new.session_id and t.status='completed';
  new.system_cash:=v_session.opening_float+v_cash; new.system_transfer:=v_transfer; new.system_qris:=v_qris;
  new.confirmed_by:=(select auth.uid()); new.confirmed_at:=clock_timestamp();
  return new;
end; $$;

create or replace function private.require_closing_record_before_session_close()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status='open' and new.status='closed' then
    if (select auth.uid()) is distinct from old.opened_by then raise exception 'The employee who opened this session must close it' using errcode='23514'; end if;
    if not exists(select 1 from public.cashier_session_closings c where c.session_id=old.id) then raise exception 'A confirmed cashier closing report is required before closing this session' using errcode='23514'; end if;
    new.closed_by:=(select auth.uid()); new.closed_at:=clock_timestamp();
  end if;
  return new;
end; $$;
