# Supabase database

Project reference: `vxwjztlayceovovizvbu`.

## Current connected project

The linked Supabase project has the active schema and migrations applied. All 32 exposed `public` tables currently have Row Level Security enabled. Storage buckets for Self Order and subscription payment proofs are private and restricted to image/PDF MIME types with a 5 MB limit.

## Migration reproducibility gate

Two historical SQL sources are still missing from the repository:

- `20261110150427_initial_acopos_core`
- `20261110152716_tenant_operations_payment_display_audit`

They were applied directly to the linked Supabase project before their source SQL was committed. The connected database is already running these objects, but a fresh Supabase project cannot yet be reconstructed from Git alone. Rebuild and verify a complete baseline plus the missing migration before any production release or database reset. Do not run `supabase db reset` against a fresh environment expecting this repository to reproduce the live schema until that work is complete.

The later migrations are committed under `migrations/`, including atomic cashier closing, tenant-scoped read permissions, cashier/transaction history permissions, and foreign-key index cleanup.

## Edge Functions

- `acopos-admin`: authenticated administrative actions; validates caller identity and role server-side.
- `acopos-display`: public function with JWT verification disabled intentionally; it requires a high-entropy paired-device token, stores only its SHA-256 hash, checks Tenant and Company subscription state, and returns a sanitized Customer Display payload. The pairing token is never stored in plaintext.

Never put a Supabase secret/service-role key in client-side environment variables. Only the public publishable key belongs in the Vite frontend.

## Security follow-up

Supabase Security Advisor currently reports one Auth warning: leaked-password protection is disabled. Enable it in Supabase Auth password-security settings before production release.
