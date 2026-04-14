# Supabase Setup

This directory contains the SQL artifacts required to run the CRM in Supabase mode (auth, data model, RLS, and migrations).

## Quick Navigation

- Main project README: `../README.md`
- Documentation index: `../docs/README.md`
- Base schema file: `supabase/schema.sql`
- Incremental changes: `supabase/migrations/`

## Quick Start

1. Create a project at [supabase.com](https://supabase.com).
2. Copy your project URL and anon key from **Settings -> API**.
3. Create a `.env.local` file in the project root:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. In Supabase SQL Editor, run `supabase/schema.sql`.
5. Apply pending files under `supabase/migrations/` in chronological order.
6. Restart the dev server (`npm run dev`).

When Supabase is configured, the app uses real authentication and PostgreSQL. Without valid credentials, the app can run in mock/local mode.

## Migration Notes

- Migration filenames are timestamped and should be applied in ascending order.
- Never edit an already applied migration; create a new migration for follow-up changes.
- Keep migration behavior aligned with related docs in `docs/` (runbooks/contracts).
