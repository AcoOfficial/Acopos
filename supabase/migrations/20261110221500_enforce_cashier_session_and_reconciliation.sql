create or replace function private.validate_transaction_session()
returns trigger language plpgsql set search_path = ''
as $$
declare v_session public.cashier_sessions%rowtype;
begin
  if new.cashier_session_id is null then raise exception 'POS transaction requires an open cashier session' using errcode='23514'; end if;
  select * into v_session from public.cashier_sessions where id=new.cashier_session_id;
  if not found or v_session.tenant_id <> new.tenant_id then raise exception 'Cashier session does not belong to this Tenant' using errcode='23503'; end if;
  if v_session.status <> 'open' or v_session.opened_by <> new.cashier_id then raise exception 'Only the employee who opened the active cashier session can transact in it' using errcode='23514'; end if;
  return new;
end; $$;
create trigger sales_transaction_requires_open_session before insert on public.sales_transactions for each row execute function private.validate_transaction_session();

create or replace function private.calculate_cashier_closing_totals()
returns trigger language plpgsql set search_path = ''
as $$
declare v_session public.cashier_sessions%rowtype; v_cash numeric(14,2); v_transfer numeric(14,2); v_qris numeric(14,2);
begin
  select * into v_session from public.cashier_sessions where id=new.session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'Cashier session is not open' using errcode='23514'; end if;
  if v_session.opened_by <> new.confirmed_by then raise exception 'Only the account that opened this session may close it' using errcode='23514'; end if;
  select coalesce(sum(case when p.payment_method='cash' then p.amount else 0 end),0),
         coalesce(sum(case when p.payment_method='transfer' then p.amount else 0 end),0),
         coalesce(sum(case when p.payment_method='qris' then p.amount else 0 end),0)
    into v_cash,v_transfer,v_qris
    from public.transaction_payments p join public.sales_transactions t on t.id=p.transaction_id
   where t.cashier_session_id=new.session_id and t.status='completed';
  new.system_cash:=v_session.opening_float+v_cash; new.system_transfer:=v_transfer; new.system_qris:=v_qris;
  return new;
end; $$;
create trigger cashier_closing_calculate_expected before insert on public.cashier_session_closings for each row execute function private.calculate_cashier_closing_totals();

create or replace function private.require_closing_record_before_session_close()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if old.status='open' and new.status='closed' then
    if new.closed_by is distinct from old.opened_by then raise exception 'The employee who opened this session must close it' using errcode='23514'; end if;
    if not exists(select 1 from public.cashier_session_closings c where c.session_id=old.id) then raise exception 'A confirmed cashier closing report is required before closing this session' using errcode='23514'; end if;
  end if;
  return new;
end; $$;
create trigger cashier_session_requires_closing_report before update of status on public.cashier_sessions for each row execute function private.require_closing_record_before_session_close();
create index if not exists transaction_payments_method_idx on public.transaction_payments(payment_method);
create index if not exists cashier_sessions_register_status_idx on public.cashier_sessions(register_id,status);
