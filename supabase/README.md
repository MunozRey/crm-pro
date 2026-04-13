# Supabase Setup

## Quick Start

1. Create a project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from **Settings -> API**
3. Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
4. Run the schema in the Supabase SQL editor: paste contents of `schema.sql`
5. Restart the dev server

When Supabase is configured, the app uses real authentication and PostgreSQL. Without it, it falls back to localStorage mode.
