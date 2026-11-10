# acoPos

acoPos is a multi-tenant business operations and point-of-sale platform.

## Stack
- React + TypeScript + Vite
- Supabase Auth + PostgreSQL + Row Level Security
- Netlify for preview and hosting
- Lucide React icons only

## Development
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

## Deployment policy
Deploy Previews and branch deploys are for review. Production publishing is a separately controlled one-time action and must not be repeated without explicit owner instruction.

## Security
Never place Supabase secret/service-role keys in frontend environment variables. All customer-facing tables must use Row Level Security and least-privilege policies.
