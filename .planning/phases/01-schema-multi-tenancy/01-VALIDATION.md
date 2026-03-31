---
phase: 1
slug: schema-multi-tenancy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 1 is pure SQL — no test framework exists yet (Vitest comes in Phase 10). All verification is via Supabase SQL Editor introspection queries.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — SQL introspection via Supabase SQL Editor |
| **Config file** | none — Vitest planned for Phase 10 |
| **Quick run command** | Manual SQL in Supabase dashboard |
| **Full suite command** | Manual SQL smoke tests (see below) |
| **Estimated runtime** | ~5 minutes manual |

---

## Sampling Rate

- **After every plan wave:** Run SQL smoke tests in Supabase SQL Editor
- **Before `/gsd:verify-work`:** All 5 SQL smoke tests must pass
- **Max feedback latency:** 5 minutes

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1.1-org-tables | 1.1 | 1 | SCHEMA-04 | manual-sql | `SELECT * FROM information_schema.tables WHERE table_name IN ('organizations','organization_members','invitations');` | N/A | ⬜ pending |
| 1.1-org-id-contacts | 1.1 | 1 | SCHEMA-01 | manual-sql | `SELECT column_name FROM information_schema.columns WHERE table_name='contacts' AND column_name='organization_id';` | N/A | ⬜ pending |
| 1.1-org-id-all | 1.1 | 1 | SCHEMA-01 | manual-sql | Same query for companies, deals, activities, notifications | N/A | ⬜ pending |
| 1.2-gmail-tokens | 1.2 | 1 | SCHEMA-05 | manual-sql | `SELECT column_name FROM information_schema.columns WHERE table_name='gmail_tokens';` | N/A | ⬜ pending |
| 1.3-rls-enabled | 1.3 | 2 | SCHEMA-02 | manual-sql | `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';` — all tenant tables must show rowsecurity=true | N/A | ⬜ pending |
| 1.3-rls-policies | 1.3 | 2 | SCHEMA-02 | manual-sql | `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public';` — old blind policies gone, new org-scoped policies present | N/A | ⬜ pending |
| 1.4-trigger | 1.4 | 2 | SCHEMA-03 | manual-sql | Insert into organization_members, verify `raw_app_meta_data` contains organization_id | N/A | ⬜ pending |
| 1.5-types | 1.5 | 3 | SCHEMA-01 | manual | `src/lib/database.types.ts` contains `organizations`, `organization_members`, `invitations`, `gmail_tokens` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- None — this phase has no automated test framework. All validation is SQL introspection.

*Existing infrastructure covers all phase requirements via manual SQL.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RLS enforces org isolation | SCHEMA-02 | No test framework; requires two live users in two orgs | Create 2 test orgs + 2 users. As user A: `SELECT * FROM contacts` must return 0 rows from org B. |
| JWT claim populated after trigger | SCHEMA-03 | Requires Supabase Auth session + live trigger | Insert into `organization_members`, call `supabase.auth.refreshSession()`, decode JWT — must contain `app_metadata.organization_id` |
| `database.types.ts` reflects new tables | SCHEMA-01 | Requires Supabase CLI `gen types` | Run `npx supabase gen types typescript --local > src/lib/database.types.ts` — verify Organizations, OrganizationMembers interfaces present |

---

## SQL Smoke Tests (Run in Supabase SQL Editor)

```sql
-- Smoke Test 1: organization_id exists on all core tables
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE column_name = 'organization_id' AND table_schema = 'public'
ORDER BY table_name;
-- Expected: rows for contacts, companies, deals, activities, notifications,
--           organization_members, invitations, gmail_tokens (8 rows minimum)

-- Smoke Test 2: RLS enabled on all tenant tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' ORDER BY tablename;
-- Expected: rowsecurity = true for ALL tables listed above

-- Smoke Test 3: New org-scoped policies present (old blind ones removed)
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- Expected: policies named like "contacts_org_read", "contacts_org_insert", etc.
-- NOT: "authenticated_read_contacts", "authenticated_write_contacts"

-- Smoke Test 4: New tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('organizations','organization_members','invitations','gmail_tokens');
-- Expected: 4 rows

-- Smoke Test 5: JWT claim trigger exists
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'on_org_member_created';
-- Expected: 1 row (AFTER INSERT on organization_members)
```

---

## Validation Sign-Off

- [ ] All SQL smoke tests pass in Supabase SQL Editor
- [ ] RLS isolation verified with 2 test users
- [ ] JWT claim verified after refreshSession()
- [ ] `database.types.ts` regenerated and contains new table interfaces
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
