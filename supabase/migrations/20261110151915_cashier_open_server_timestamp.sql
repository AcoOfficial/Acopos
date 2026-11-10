create or replace function private.set_cashier_opened_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.opened_at := clock_timestamp(); return new; end; $$;
drop trigger if exists cashier_session_open_server_clock on public.cashier_sessions;
create trigger cashier_session_open_server_clock before insert on public.cashier_sessions for each row execute function private.set_cashier_opened_at();
