drop policy if exists platform_settings_customer_read on public.platform_settings;
create policy platform_settings_customer_read on public.platform_settings for select to authenticated using(setting_key in ('support','payment_instructions'));
