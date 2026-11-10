
drop policy if exists companies_insert_owner on public.companies;
revoke update on public.profiles from authenticated;
grant update(display_name) on public.profiles to authenticated;
