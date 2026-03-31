---
phase: 01-schema-multi-tenancy
verified: 2026-03-31T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Apply all 5 migrations in order and verify RLS tenant isolation"
    expected: "SELECT * FROM contacts as org-A user returns zero rows belonging to org-B"
    why_human: "RLS enforcement requires a live Supabase instance; cannot be statically verified"
  - test: "Insert a row into organization_members and verify JWT claim is populated"
    expected: "After supabase.auth.refreshSession(), auth.jwt() -> 'app_metadata' ->> 'organization_id' is non-null for that user"
    why_human: "Trigger execution and JWT propagation require a running Postgres + Supabase Auth; not statically verifiable"
  - test: "Verify old blind policies are gone from live schema"
    expected: "SELECT policyname FROM pg_policies WHERE policyname LIKE 'authenticated_%' returns 0 rows"
    why_human: "DROP POLICY IF EXISTS is correct SQL but actual removal requires migration to be applied"
  - test: "Confirm gmail_tokens RLS blocks cross-user reads"
    expected: "User B cannot SELECT rows from gmail_tokens where user_id = User A's UUID"
    why_human: "Cross-user RLS isolation requires a running Supabase instance with two authenticated sessions"
---

# Phase 1: Schema & Multi-Tenancy — Verification Report

**Phase Goal:** Every table has `organization_id` + RLS enforced via JWT claims; all new tables (organizations, members, invitations, gmail_tokens) are created and indexed.
**Verified:** 2026-03-31
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 5 core tables have `organization_id uuid NOT NULL` added via migration | VERIFIED | Migration 002: 5 `ADD COLUMN IF NOT EXISTS organization_id` statements, 5 FK references to `organizations(id) ON DELETE CASCADE`, 5 `TRUNCATE TABLE` pre-clears |
| 2 | `organizations`, `organization_members`, `invitations` tables are created | VERIFIED | Migration 001: 3 `CREATE TABLE IF NOT EXISTS` statements confirmed; UNIQUE, FK, and index constraints present |
| 3 | `gmail_tokens` table exists with `refresh_token NOT NULL`, `user_id`, `organization_id` | VERIFIED | Migration 003: table DDL present with `refresh_token text NOT NULL`, FK to `auth.users` and `organizations`, `UNIQUE(user_id, organization_id)` |
| 4 | RLS policies use `public.get_org_id()`, not inline `auth.jwt()` casts | VERIFIED | Migration 004: 18 occurrences of `public.get_org_id()` in policy expressions; only 1 occurrence of `auth.jwt()` in the file — in a comment block documenting the anti-pattern (line 7), zero in any policy expression |
| 5 | Old blind policies (`authenticated_read_*`, `authenticated_write_*`) are dropped | VERIFIED | Migration 004: 9 `DROP POLICY IF EXISTS` statements covering authenticated_read/write for contacts, companies, deals, activities, and own_notifications |
| 6 | JWT trigger `handle_new_member()` exists with `SECURITY DEFINER` | VERIFIED | Migration 005 line 16: `RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$`; 2 `PERFORM public.set_claim(...)` calls for `organization_id` and `user_role` |
| 7 | Trigger `on_org_member_created` fires `AFTER INSERT OR UPDATE` on `organization_members` | VERIFIED | Migration 005 line 41: `AFTER INSERT OR UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.handle_new_member()`; DROP + CREATE present (idempotent) |
| 8 | `database.types.ts` has `organization_id: string` on all 5 existing table Row types | VERIFIED | 8 occurrences of `organization_id: string` — 5 in existing tables (contacts, companies, deals, activities, notifications) + 3 in new tables (organization_members, invitations, gmail_tokens). Correct: `organizations` is the root table and has no self-referencing `organization_id` |
| 9 | `database.types.ts` has interfaces for `organizations`, `organization_members`, `invitations`, `gmail_tokens` | VERIFIED | All 4 table definitions found at lines 133, 149, 169, 187. `gmail_tokens.refresh_token: string` (non-nullable). `gmail_tokens.access_token: string \| null` (nullable). `invitations` Insert has `token?: string` (DB-generated default) |

**Score: 9/9 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260331000001_create_org_tables.sql` | Wave 1: orgs, members, invitations + JWT helpers | VERIFIED | 128 lines; 3 tables, 3 helper functions, 3 RLS enabled, 4 indexes, `UNIQUE(organization_id, user_id)`, `gen_random_bytes(32)` token |
| `supabase/migrations/20260331000002_add_organization_id.sql` | Wave 2: ALTER 5 existing tables | VERIFIED | 56 lines; 5 TRUNCATE, 5 ADD COLUMN NOT NULL, 5 FK to organizations, 5 indexes |
| `supabase/migrations/20260331000003_create_gmail_tokens.sql` | Wave 2: gmail_tokens table | VERIFIED | 46 lines; `refresh_token NOT NULL`, `UNIQUE(user_id, organization_id)`, RLS policy, composite index, updated_at trigger |
| `supabase/migrations/20260331000004_rls_policies.sql` | Wave 3: Replace blind policies with JWT-claim policies | VERIFIED | 103 lines; 9 DROP POLICY, 17 CREATE POLICY, 18 `get_org_id()` calls, 4 WITH CHECK (INSERT only), 0 inline `auth.jwt()` casts in policy expressions |
| `supabase/migrations/20260331000005_jwt_trigger.sql` | Wave 3: JWT claim trigger | VERIFIED | 43 lines; `handle_new_member` SECURITY DEFINER, AFTER INSERT OR UPDATE, 2 `set_claim` calls, idempotent DROP + CREATE |
| `src/lib/database.types.ts` | Updated TypeScript types for all 9 tables | VERIFIED | 212 lines; 5 existing tables all have `organization_id: string`; 4 new table definitions with correct nullability (`refresh_token: string`, `access_token: string \| null`, `token?: string`) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Migration 002 | `organizations` table | FK `REFERENCES public.organizations(id)` | VERIFIED | Migration 001 must run first; dependency comment present in migration 002 header |
| Migration 003 | `organizations` + `get_org_id()` | FK + function call in RLS policy | VERIFIED | Dependency note on line 9 of migration 003; `public.get_org_id()` called in the `users_own_gmail_tokens` policy |
| Migration 004 | `get_org_id()` / `get_user_role()` | Function calls in all USING/WITH CHECK clauses | VERIFIED | 18 uses of `get_org_id()` across 17 policies; helper functions defined in migration 001 (Wave 1, must precede Wave 3) |
| Migration 005 | `set_claim()` + `organization_members` | PERFORM call inside trigger function body | VERIFIED | `PERFORM public.set_claim(NEW.user_id, 'organization_id', ...)` and `PERFORM public.set_claim(NEW.user_id, 'user_role', ...)` both present |
| `database.types.ts` | Migration schema | Hand-authored type reflection | VERIFIED | All column names, nullability, and optional Insert fields match migration DDL |

---

## Data-Flow Trace (Level 4)

Not applicable. Phase 1 is pure SQL migrations and TypeScript type definitions — no components, no API routes, no dynamic data rendering. Level 4 data-flow tracing applies to phases that produce runnable application code.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points. Phase 1 produces only SQL migration files and a TypeScript type file. Behavioral verification requires applying migrations to a live Supabase instance (see Human Verification Required section).

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCHEMA-01 | 01.1, 01.5 | All core tables have `organization_id uuid NOT NULL` | SATISFIED | Migration 002 adds column to 5 tables; database.types.ts Row types confirmed |
| SCHEMA-02 | 01.4 | RLS policies enforce JWT claim `organization_id = get_org_id()` | SATISFIED | Migration 004: 17 policies all call `public.get_org_id()`; old blind policies dropped |
| SCHEMA-03 | 01.5 | Trigger sets `organization_id` in JWT `app_metadata` on membership changes | SATISFIED | Migration 005: `handle_new_member` SECURITY DEFINER + AFTER INSERT OR UPDATE trigger; runtime confirmation is human item #2 |
| SCHEMA-04 | 01.2 | `organizations` and `organization_members` tables created with correct FK structure | SATISFIED | Migration 001: both tables exist with FK CASCADE, UNIQUE constraint, and indexes |
| SCHEMA-05 | 01.3 | `gmail_tokens` table created for server-side refresh token storage | SATISFIED | Migration 003: table exists with `refresh_token NOT NULL`, RLS preventing cross-user reads |

**All 5 SCHEMA requirements: SATISFIED (static analysis)**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `20260331000004_rls_policies.sql` | 7 | `auth.jwt()` appears in file | Info | Comment only — documents the anti-pattern to avoid. Zero occurrences in actual policy expressions. Not a blocker. |
| `20260331000002_add_organization_id.sql` | 11-15 | `TRUNCATE TABLE ... CASCADE` | Info | Intentional design decision for dev-only database. WARNING comment present in file. Not a blocker for dev; would be destructive on production. Apply order enforcement is critical. |

No blockers or warnings found. Both flagged items are intentional and documented within the migration files themselves.

---

## Human Verification Required

### 1. RLS Tenant Isolation

**Test:** Apply all 5 migrations in order in Supabase SQL Editor. Create two organizations (Org A, Org B). Create a user for each. Insert contacts into each org. Log in as the Org A user and run `SELECT * FROM contacts`.
**Expected:** Zero rows from Org B are returned. Only Org A contacts are visible.
**Why human:** RLS enforcement runs inside PostgreSQL at query time. Static analysis can confirm the policy SQL is correctly written, but cannot verify that Postgres evaluates it correctly or that `get_org_id()` resolves the JWT claim as expected.

### 2. JWT Claim Population via Trigger

**Test:** After applying migration 005, insert a row into `organization_members` for a test user. Then call `supabase.auth.refreshSession()` in the client.
**Expected:** `auth.jwt() -> 'app_metadata' ->> 'organization_id'` returns the correct UUID. `auth.jwt() -> 'app_metadata' ->> 'user_role'` returns the assigned role string.
**Why human:** Trigger execution, `set_claim` writing to `auth.users.raw_app_meta_data`, and JWT refresh cycle require a running Supabase Auth + Postgres environment. SECURITY DEFINER correctness is runtime-dependent.

### 3. Old Blind Policy Removal

**Test:** After applying migration 004, run in Supabase SQL Editor: `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE 'authenticated_%';`
**Expected:** 0 rows returned.
**Why human:** `DROP POLICY IF EXISTS` is correct SQL, but actual removal is only verifiable against a live schema where the old policies were previously created by `schema.sql`.

### 4. gmail_tokens Cross-User RLS Block

**Test:** As User A, insert a row into `gmail_tokens`. Log in as User B (same org). Run `SELECT * FROM gmail_tokens`.
**Expected:** Zero rows returned for User B. User A can still SELECT their own row.
**Why human:** The `users_own_gmail_tokens` policy combines `user_id = auth.uid() AND organization_id = public.get_org_id()`. Both conditions must be active simultaneously. Verification requires two authenticated sessions against a live Supabase project.

---

## Gaps Summary

No gaps found. All 9 must-haves are verified by static analysis of the migration files and TypeScript types.

The `human_needed` status reflects that Phase 1's success criteria (from ROADMAP.md) are runtime behaviors — cross-tenant data isolation and JWT claim population — which cannot be confirmed without applying the migrations to a live Supabase instance. The SQL artifacts are complete, correct, and ready to apply.

**Migration apply order:**
1. `20260331000001_create_org_tables.sql` (Wave 1 — no dependencies)
2. `20260331000002_add_organization_id.sql` (Wave 2 — depends on 001 for `organizations` FK)
3. `20260331000003_create_gmail_tokens.sql` (Wave 2 — depends on 001 for `organizations` FK and `get_org_id()`)
4. `20260331000004_rls_policies.sql` (Wave 3 — depends on 001 for helper functions, 002 for `organization_id` columns)
5. `20260331000005_jwt_trigger.sql` (Wave 3 — depends on 001 for `set_claim()` and `organization_members` table)

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
