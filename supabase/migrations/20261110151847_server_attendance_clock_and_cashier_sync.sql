-- Server-authoritative attendance timestamps and automatic cashier attendance.
create unique index if not exists attendance_manual_one_open_per_employee_tenant
on public.attendance_records (tenant_id, employee_id)
where source = 'manual' and check_out_at is null;

create unique index if not exists attendance_one_record_per_cashier_session
on public.attendance_records (cashier_session_id)
where cashier_session_id is not null;

create or replace function private.enforce_manual_attendance_clock()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.source = 'manual' then
    if new.employee_id <> (select auth.uid()) then
      raise exception 'Manual attendance must belong to the signed-in employee';
    end if;
    new.cashier_session_id := null;
    new.check_in_at := clock_timestamp();
    new.check_out_at := null;
    new.created_at := clock_timestamp();
  elsif tg_op = 'UPDATE' and old.source = 'manual'
        and old.employee_id = (select auth.uid())
        and old.check_out_at is null then
    if new.employee_id <> old.employee_id
       or new.tenant_id <> old.tenant_id
       or new.source <> old.source
       or new.cashier_session_id is distinct from old.cashier_session_id then
      raise exception 'Attendance identity and tenant cannot be changed';
    end if;
    new.check_in_at := old.check_in_at;
    new.check_out_at := clock_timestamp();
    new.corrected_by := old.corrected_by;
    new.correction_reason := old.correction_reason;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_manual_attendance_clock() from public;
drop trigger if exists attendance_manual_server_clock on public.attendance_records;
create trigger attendance_manual_server_clock
before insert or update on public.attendance_records
for each row execute function private.enforce_manual_attendance_clock();

create or replace function private.sync_cashier_session_attendance()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'open' then
    insert into public.attendance_records
      (tenant_id, employee_id, source, cashier_session_id, check_in_at)
    values
      (new.tenant_id, new.opened_by, 'cashier_session', new.id, coalesce(new.opened_at, clock_timestamp()))
    on conflict (cashier_session_id) where cashier_session_id is not null do nothing;
  elsif tg_op = 'UPDATE' and old.status = 'open' and new.status = 'closed' then
    update public.attendance_records
       set check_out_at = coalesce(new.closed_at, clock_timestamp())
     where cashier_session_id = new.id
       and employee_id = old.opened_by
       and check_out_at is null;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_cashier_session_attendance() from public;
drop trigger if exists cashier_session_attendance_sync on public.cashier_sessions;
create trigger cashier_session_attendance_sync
after insert or update of status on public.cashier_sessions
for each row execute function private.sync_cashier_session_attendance();

create or replace function private.set_cashier_opened_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.opened_at := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists cashier_session_open_server_clock on public.cashier_sessions;
create trigger cashier_session_open_server_clock
before insert on public.cashier_sessions
for each row execute function private.set_cashier_opened_at();
