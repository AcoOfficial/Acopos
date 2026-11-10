drop trigger if exists cashier_session_attendance_sync on public.cashier_sessions;
drop function if exists private.sync_cashier_session_attendance();
