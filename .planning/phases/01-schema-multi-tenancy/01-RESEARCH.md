# Phase 1: Schema & Multi-Tenancy — Research

**Researched:** 2026-03-31
**Domain:** Supabase PostgreSQL — schema migrations, RLS, JWT claims, triggers
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | All core tables (contacts, companies, deals, activities, notifications, goals, sequences, automations, templates, products) have `organization_id uuid NOT NULL` column | ALTER TABLE migrations documented; existing 5 tables confirmed, additional 5 tables will need same treatment |
| SCHEMA-02 | RLS policies on all tables enforce `organization_id = (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` (JWT claim, not subquery) | Full RLS policy pattern verified in prior research; helper functions `get_org_id()` and `get_user_role()` confirmed |
| SCHEMA-03 | Trigger sets `organization_id` in JWT `app_metadata` on org membership changes | `handle_new_member` trigger pattern fully documented in prior research; fires on INSERT OR UPDATE |
| SCHEMA-04 | `organizations` and `organization_members` tables created with correct FK structure | Full DDL for both tables + `invitations` table in prior research |
| SCHEMA-05 | `gmail_tokens` table created to store refresh tokens server-side (never in browser) | Table design specified below; must be user+org scoped with RLS |
</phase_requirements>

---

## Summary

Phase 1 is a pure SQL/database phase — no TypeScript application code changes beyond updating `database.types.ts`. Every task produces a `.sql` migration file and, at the end, a regenerated type file. The existing `schema.sql` has 5 tables (contacts, companies, deals, activities, notifications) with no `organization_id` column and RLS policies that are tenant-blind (`auth.role() = 'authenticated'`). This phase fixes all of that.

The locked architectural decision is to use the `organization_id` column pattern with JWT-claim-based RLS — NOT schema-per-tenant and NOT per-row subquery lookups. This is the correct approach for Supabase: schema-per-tenant is unsupported on hosted Supabase, and subquery RLS has O(n) performance per row checked. JWT claims are O(1).

The critical dependency order within this phase is: (1) create `organizations` table first, (2) add `organization_id` column to core tables, (3) create supporting tables (`organization_members`, `invitations`, `gmail_tokens`), (4) write RLS policies (they reference `organizations` by FK), (5) write trigger last (it writes to `auth.users.raw_app_meta_data` and depends on `organization_members` existing). If this order is violated, FK constraint errors will block the migration.

**Primary recommendation:** Write all SQL as a single ordered migration file (`supabase/migrations/YYYYMMDDHHMMSS_schema_multitenancy.sql`) so it can be applied atomically. Within the file, follow the dependency order above. Update `database.types.ts` manually at the end — the Supabase CLI `supabase gen types typescript` command requires a live project; manual update is safer for this phase.

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.100.1` (already installed) | PostgREST client + Auth + Realtime | Already in package.json; v2 is stable LTS |
| PostgreSQL (Supabase) | 15.x (Supabase default) | All DDL: CREATE TABLE, ALTER TABLE, CREATE POLICY, CREATE TRIGGER | Supabase hosted |
| `uuid-ossp` extension | Supabase built-in | `uuid_generate_v4()` for PKs | Already enabled in schema.sql |
| `pgcrypto` extension | Supabase built-in | `gen_random_bytes(32)` for invitation tokens | Required for secure token generation |

### No New NPM Packages Required

This phase is 100% SQL. The only TypeScript artifact updated is `src/lib/database.types.ts`, which is a hand-edited type file — no new package installs needed.

---

## Architecture Patterns

### Migration File Structure

All SQL for this phase belongs in one ordered file:

```
supabase/
├── schema.sql             (existing — baseline, do not modify in place)
└── migrations/
    └── 20260331000001_schema_multitenancy.sql   (new — this phase's work)
```

The migration file must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` before `CREATE POLICY`).

### Correct Dependency Order Within Migration

```sql
-- STEP 1: Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- STEP 2: Organizations table (must exist before any FK to it)
CREATE TABLE public.organizations (...);

-- STEP 3: ADD organization_id to existing tables (FK to organizations)
ALTER TABLE public.contacts  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.deals     ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- STEP 4: Create new tables (organization_members, invitations, gmail_tokens)
CREATE TABLE public.organization_members (...);
CREATE TABLE public.invitations (...);
CREATE TABLE public.gmail_tokens (...);

-- STEP 5: Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON public.contacts(organization_id);
-- ... (one per organization_id column)

-- STEP 6: RLS — drop old policies, enable RLS, create new policies
DROP POLICY IF EXISTS "authenticated_read_contacts" ON public.contacts;
DROP POLICY IF EXISTS "authenticated_write_contacts" ON public.contacts;
-- ... (drop all existing blind policies first)
CREATE POLICY "org_members_can_read_contacts" ON public.contacts
  FOR SELECT USING (organization_id = public.get_org_id());
-- ...

-- STEP 7: Helper functions (get_org_id, get_user_role, set_claim)
CREATE OR REPLACE FUNCTION public.get_org_id() ...
CREATE OR REPLACE FUNCTION public.get_user_role() ...
CREATE OR REPLACE FUNCTION public.set_claim(...) ...

-- STEP 8: JWT trigger (depends on organization_members existing)
CREATE OR REPLACE FUNCTION public.handle_new_member() ...
CREATE TRIGGER on_member_created
  AFTER INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();
```

### Organizations Table DDL

```sql
-- Source: prior research supabase-multitenant.md
CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL,
  domain      text,
  logo_url    text,
  plan        text NOT NULL DEFAULT 'free',
  max_users   integer NOT NULL DEFAULT 5,
  settings    jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Members can read their own org
CREATE POLICY "members_can_read_own_org" ON public.organizations
  FOR SELECT USING (
    id = public.get_org_id()
  );

-- Only admins can update org settings
CREATE POLICY "admins_can_update_org" ON public.organizations
  FOR UPDATE USING (
    id = public.get_org_id()
    AND public.get_user_role() = 'admin'
  );
```

### Organization Members Table DDL

```sql
-- Source: prior research supabase-multitenant.md
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text NOT NULL DEFAULT 'sales_rep',
  job_title       text,
  phone           text,
  avatar_url      text,
  is_active       boolean NOT NULL DEFAULT true,
  invited_by      uuid REFERENCES auth.users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_org_members" ON public.organization_members
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "admins_can_manage_members" ON public.organization_members
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'manager')
  );
```

### Invitations Table DDL

```sql
CREATE TABLE IF NOT EXISTS public.invitations (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            text NOT NULL DEFAULT 'sales_rep',
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid NOT NULL REFERENCES auth.users(id),
  status          text NOT NULL DEFAULT 'pending',
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_manage_invitations" ON public.invitations
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'manager')
  );
```

### Gmail Tokens Table DDL

```sql
-- Designed for SCHEMA-05 and SEC-05: refresh tokens NEVER in browser/localStorage
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token    text,                         -- short-lived, may be cached
  refresh_token   text NOT NULL,                -- long-lived, encrypted at rest by Supabase
  token_type      text NOT NULL DEFAULT 'Bearer',
  scope           text NOT NULL,                -- space-separated Gmail scopes granted
  expires_at      timestamptz,                  -- when access_token expires
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)              -- one token set per user per org
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own tokens
CREATE POLICY "users_own_gmail_tokens" ON public.gmail_tokens
  FOR ALL USING (
    user_id = auth.uid()
    AND organization_id = public.get_org_id()
  );

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.gmail_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### JWT Claim Helper Functions

```sql
-- Source: prior research supabase-multitenant.md
-- These functions are referenced by every RLS policy — define before policies.

CREATE OR REPLACE FUNCTION public.set_claim(uid uuid, claim text, value jsonb)
RETURNS text AS $$
  UPDATE auth.users
  SET raw_app_meta_data =
    raw_app_meta_data ||
    json_build_object(claim, value)::jsonb
  WHERE id = uid
  RETURNING raw_app_meta_data::text;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid,
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    'viewer'
  );
$$;
```

### JWT Trigger

```sql
-- Source: prior research supabase-multitenant.md
-- Fires on INSERT OR UPDATE of organization_members row.
-- Writes organization_id and role into auth.users.raw_app_meta_data.

CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.set_claim(
    NEW.user_id,
    'organization_id',
    to_jsonb(NEW.organization_id)
  );
  PERFORM public.set_claim(
    NEW.user_id,
    'user_role',
    to_jsonb(NEW.role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_member_created
  AFTER INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();
```

### RLS Policy Pattern for Core Tables

Apply four policies per table. Use `get_org_id()` helper, never inline the JWT cast:

```sql
-- Replace blind "authenticated" policies. Pattern shown for contacts; repeat for
-- companies, deals, activities.

DROP POLICY IF EXISTS "authenticated_read_contacts"  ON public.contacts;
DROP POLICY IF EXISTS "authenticated_write_contacts" ON public.contacts;

CREATE POLICY "org_members_can_read_contacts" ON public.contacts
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_update_contacts" ON public.contacts
  FOR UPDATE USING (organization_id = public.get_org_id());

CREATE POLICY "managers_can_delete_contacts" ON public.contacts
  FOR DELETE USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'manager')
  );
```

Notifications already uses `auth.uid() = user_id` — keep that policy and ADD an org scope:

```sql
DROP POLICY IF EXISTS "own_notifications" ON public.notifications;

CREATE POLICY "own_notifications" ON public.notifications
  FOR ALL USING (
    user_id = auth.uid()
    AND organization_id = public.get_org_id()
  );
```

### database.types.ts Update Pattern

After all SQL is applied, `src/lib/database.types.ts` must be updated manually to add:
- `organization_id: string` field to `contacts`, `companies`, `deals`, `activities`, `notifications` Row/Insert/Update types
- New table types: `organizations`, `organization_members`, `invitations`, `gmail_tokens`

The file currently has 133 lines. The update adds approximately 120 lines. The existing structure and pattern (Row / Insert / Update types) must be followed exactly.

### Anti-Patterns to Avoid

- **Subquery in RLS:** `USING (organization_id = (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))` — runs a subquery per row, catastrophically slow at scale. Use `get_org_id()` (reads from JWT) instead.
- **Schema-per-tenant:** Not supported on hosted Supabase. Do not attempt.
- **Inline JWT cast in every policy:** `(auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid` duplicated 20+ times. Use helper functions.
- **Forgetting SECURITY DEFINER on set_claim:** Without it, the function cannot write to `auth.users`. The trigger will silently fail.
- **Applying RLS policies before helper functions exist:** Policies reference `get_org_id()` — if that function doesn't exist yet, the `CREATE POLICY` statement errors. Define functions before policies.
- **NOT NULL without a default on ALTER TABLE:** Adding `organization_id uuid NOT NULL` to a table that already has rows will fail. Two options: (1) add a default value temporarily, backfill, remove default; (2) if the project is fresh/dev only, truncate tables first. For a dev project with no live data, truncating is simpler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT `app_metadata` writes | Custom HTTP call to Auth API | `set_claim` SQL function with SECURITY DEFINER | Auth API requires service role key; DB function runs with elevated privilege safely inside Postgres |
| Invitation token generation | `Math.random()` or UUID | `encode(gen_random_bytes(32), 'hex')` (pgcrypto) | Cryptographically secure; deterministic UUID is predictable and can be guessed |
| Org membership lookup in RLS | JOIN subquery per row | `get_org_id()` reading from JWT `app_metadata` | O(1) JWT read vs O(n) subquery — critical at scale |
| Manual TypeScript types | Handwrite every field | `supabase gen types typescript --project-id $ID` (or manual update following existing pattern) | Keeps types in sync with schema; drift causes silent runtime errors |

---

## Runtime State Inventory

This phase is database-schema-only (greenfield tables + ALTER on existing tables). No rename/rebrand is performed. The project has no existing production data.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | No production data — project is pre-launch; all tables are empty dev-only | None |
| Live service config | No live Supabase project confirmed yet (env vars may be absent) | Configure `.env.local` before running migration |
| OS-registered state | None | None |
| Secrets/env vars | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be in `.env.local`; `SUPABASE_SERVICE_ROLE_KEY` is needed only for Edge Functions (Phase 7+), not this phase | None for Phase 1 |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: ALTER TABLE NOT NULL Fails on Non-Empty Table

**What goes wrong:** `ALTER TABLE contacts ADD COLUMN organization_id uuid NOT NULL` errors with "column contains null values" if the table already has any rows.

**Why it happens:** PostgreSQL enforces NOT NULL constraints on existing rows immediately.

**How to avoid:** Either (a) add the column as nullable first, backfill with a placeholder org UUID, then add the NOT NULL constraint; or (b) since this is a dev project with no live data, truncate all core tables before running the migration. Option (b) is simpler and appropriate here.

**Warning signs:** Migration fails with `ERROR: column "organization_id" contains null values`.

### Pitfall 2: RLS Locks Out the Planner/Admin

**What goes wrong:** After enabling RLS with org-scoped policies, any query run by a user whose JWT `app_metadata` does not yet have `organization_id` returns zero rows (or insert is blocked). This will affect testing immediately after migration.

**Why it happens:** The JWT claim is only set when a row is inserted into `organization_members`. A freshly created Supabase user has no org membership, so `get_org_id()` returns NULL, and `organization_id = NULL` is never true.

**How to avoid:** When testing, always insert a test row into `organization_members` (which fires the trigger and populates JWT), then call `supabase.auth.refreshSession()` to get a new JWT that carries the claim. Never test RLS with a bare newly-created user.

**Warning signs:** `SELECT * FROM contacts` returns 0 rows even though rows exist.

### Pitfall 3: JWT Claim is Stale After Trigger Fires

**What goes wrong:** The `handle_new_member` trigger writes to `auth.users.raw_app_meta_data`, but the user's current JWT was issued before that write. The JWT is cached and won't reflect the new claim until it is refreshed.

**Why it happens:** JWTs are signed at issuance time. Supabase access tokens live for 1 hour by default.

**How to avoid:** After inserting into `organization_members` (e.g., during onboarding), immediately call `await supabase.auth.refreshSession()` from the client. This forces a new JWT to be issued that includes the newly set `organization_id` claim.

**Warning signs:** RLS still returns 0 rows after membership insert; checking `auth.jwt() -> 'app_metadata'` in a SQL console shows the claim is missing.

### Pitfall 4: Missing Index on organization_id Causes Full Table Scans

**What goes wrong:** Every SELECT, INSERT, UPDATE, DELETE on a tenant-scoped table runs the RLS policy, which filters by `organization_id`. Without an index, Postgres performs a sequential scan of the entire table for every operation.

**Why it happens:** RLS filters run before the query's own WHERE clause, so the index must be on `organization_id` alone (not a composite index that starts with a different column).

**How to avoid:** Add `CREATE INDEX idx_{table}_org_id ON public.{table}(organization_id)` for every tenant-scoped table.

**Warning signs:** Slow queries after data volume grows; `EXPLAIN ANALYZE` shows "Seq Scan" instead of "Index Scan" on tables with RLS.

### Pitfall 5: Policies Created Before Helper Functions Exist

**What goes wrong:** `CREATE POLICY ... USING (organization_id = public.get_org_id())` fails if `get_org_id()` is not yet defined.

**Why it happens:** SQL executes statements in order; forward references don't work.

**How to avoid:** In the migration file, define all helper functions (STEP 7 in the dependency order above) before any `CREATE POLICY` statements that reference them — or alternatively define functions first in the file (STEP 2.5) and policies later.

**Warning signs:** `ERROR: function public.get_org_id() does not exist`.

### Pitfall 6: set_claim Function Missing SECURITY DEFINER

**What goes wrong:** The trigger calls `set_claim()` to write to `auth.users.raw_app_meta_data`. Without `SECURITY DEFINER`, the function runs as the calling user (who does not have permission to write to the `auth` schema).

**Why it happens:** The `auth` schema is owned by the Supabase internal role, not `postgres` or `authenticated`.

**How to avoid:** Always declare `CREATE OR REPLACE FUNCTION public.set_claim(...) ... SECURITY DEFINER`.

**Warning signs:** Trigger fires without error but `app_metadata` is not updated; checking `raw_app_meta_data` in the Supabase auth users table shows no `organization_id` key.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Supabase project (hosted) | Running all migrations | Assumed — env vars expected in `.env.local` | — | Cannot run migration without a live Supabase project |
| `@supabase/supabase-js` | `supabase.ts` client | Already in `package.json` | `^2.100.1` | — |
| `pgcrypto` extension | `gen_random_bytes` in invitations table | Built into all Supabase projects | — | Use `uuid_generate_v4()` as fallback (less secure) |
| `uuid-ossp` extension | `uuid_generate_v4()` PKs | Already enabled in `schema.sql` | — | — |
| Supabase CLI | `supabase gen types typescript` | Not verified — optional for this phase | — | Manual `database.types.ts` update |

**Missing dependencies with no fallback:**
- A configured Supabase project. The migration SQL must be run against a live project via the Supabase dashboard SQL editor or Supabase CLI `supabase db push`.

**Missing dependencies with fallback:**
- Supabase CLI: not required. Types can be manually updated following the existing `database.types.ts` pattern.

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured yet — Vitest is planned for Phase 10 (TEST-01) |
| Config file | None — `package.json` has no `test` script |
| Quick run command | N/A until Phase 10 |
| Full suite command | N/A until Phase 10 |

Because no test framework is installed in Phase 1, automated unit testing is not applicable. Validation for this phase is SQL-level verification via the Supabase SQL editor and manual smoke tests.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Verification Method |
|--------|----------|-----------|-------------------|---------------------|
| SCHEMA-01 | All core tables have `organization_id` column | manual-sql | N/A | `SELECT column_name FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'organization_id';` — must return 1 row for each of 5 tables |
| SCHEMA-02 | RLS enforces org isolation — user from org A cannot see org B rows | manual-sql | N/A | Create two test orgs + users; as user A, `SELECT * FROM contacts` returns only org A rows |
| SCHEMA-03 | Trigger populates JWT `app_metadata.organization_id` on member insert | manual-sql | N/A | Insert into `organization_members`, call `SELECT raw_app_meta_data FROM auth.users WHERE id = $uid` — must contain `organization_id` key |
| SCHEMA-04 | `organizations` and `organization_members` tables exist with FK constraints | manual-sql | N/A | `SELECT * FROM information_schema.tables WHERE table_name IN ('organizations','organization_members','invitations');` — must return 3 rows |
| SCHEMA-05 | `gmail_tokens` table exists with correct columns and RLS | manual-sql | N/A | `SELECT column_name FROM information_schema.columns WHERE table_name = 'gmail_tokens';` — must include `refresh_token`, `user_id`, `organization_id` |

### SQL Smoke Tests (Run in Supabase SQL Editor)

```sql
-- Test 1: Verify organization_id column exists on all core tables
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE column_name = 'organization_id'
  AND table_schema = 'public'
ORDER BY table_name;
-- Expected: rows for contacts, companies, deals, activities, notifications,
--           organization_members, invitations, gmail_tokens

-- Test 2: Verify RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Expected: rowsecurity = true for all tenant-scoped tables

-- Test 3: Verify policies exist
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
-- Expected: 4 policies per core table (read, insert, update, delete), NOT the old "authenticated_read/write" blind policies

-- Test 4: Verify trigger exists
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'on_member_created';
-- Expected: 1 row, AFTER INSERT and AFTER UPDATE on organization_members

-- Test 5: Verify helper functions exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_org_id', 'get_user_role', 'set_claim', 'handle_new_member');
-- Expected: 4 rows

-- Test 6: Verify indexes
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_org_id'
ORDER BY tablename;
-- Expected: one index per tenant-scoped table
```

### RLS Isolation Smoke Test (Requires Two Test Users)

```sql
-- As a service_role query (bypasses RLS), insert orgs and users first:
-- 1. Create org_a, org_b in organizations table
-- 2. Insert contacts with org_a's organization_id
-- 3. Insert contacts with org_b's organization_id
-- 4. Log in as user_a (member of org_a), run: SELECT count(*) FROM contacts
--    Expected: only org_a's contact count
-- 5. Log in as user_b (member of org_b), run: SELECT count(*) FROM contacts
--    Expected: only org_b's contact count
```

### Done When (from Phase Definition)

- [ ] `SELECT * FROM contacts` as a user from org A returns zero rows from org B
- [ ] `organization_members` insert fires the trigger and JWT `app_metadata` is populated (verified by reading `raw_app_meta_data` or by calling `supabase.auth.getSession()` after `refreshSession()` and inspecting `session.user.app_metadata.organization_id`)
- [ ] `gmail_tokens` table exists with correct columns and RLS
- [ ] `database.types.ts` reflects all new tables with `organization_id` on existing tables

### Wave 0 Gaps

- [ ] No test framework configured — install Vitest (`npm install -D vitest @testing-library/react jsdom`) is deferred to Phase 10 (TEST-01). SQL validation for this phase is done via Supabase SQL editor, not automated test runner.

*(This phase is SQL-only; automated test infrastructure is not required to deliver SCHEMA-01 through SCHEMA-05.)*

---

## Sources

### Primary (HIGH confidence)

- Prior research `supabase-multitenant.md` — full RLS/JWT/trigger patterns verified with code examples
- `supabase/schema.sql` — confirmed existing table structure and current (broken) RLS policies
- `src/lib/database.types.ts` — confirmed existing TypeScript types that need updating
- `package.json` — confirmed `@supabase/supabase-js@^2.100.1` already installed
- Supabase official docs on RLS (verified patterns are consistent with v2 SDK)

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — SCHEMA-01 through SCHEMA-05 definitions
- `.planning/STATE.md` — confirmed architectural decisions (JWT claim RLS, no schema-per-tenant)

### Tertiary (LOW confidence)

- None — all findings in this phase are verifiable from the local codebase and prior research document.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages already installed, SQL patterns verified in prior research
- Architecture: HIGH — dependency order verified against PostgreSQL FK constraint rules
- Pitfalls: HIGH — each pitfall is a concrete failure mode with a known SQL error message
- Validation: HIGH — SQL introspection queries are deterministic

**Research date:** 2026-03-31
**Valid until:** Stable — Supabase v2 / PostgreSQL 15 patterns are stable; no fast-moving dependencies in this phase
