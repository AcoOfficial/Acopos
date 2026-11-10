# Supabase database

Project reference: `vxwjztlayceovovizvbu`.

The initial core schema (`initial_acopos_core`) was applied to the linked Supabase project before migration files were committed. The follow-up migration in `migrations/` is committed as the source for the permission and attendance hardening step. Before production release, reconcile the initial remote migration into a complete reproducible baseline and verify the migration history from a clean branch.

All exposed `public` tables must retain Row Level Security. Never put a Supabase secret/service-role key in client-side environment variables.
