---
status: partial
phase: 01-schema-multi-tenancy
source: [01-VERIFICATION.md]
started: 2026-03-31T00:00:00Z
updated: 2026-03-31T00:00:00Z
---

## Current Test

[awaiting human testing — requires live Supabase instance]

## Tests

### 1. RLS tenant isolation
expected: A user from Org A querying `SELECT * FROM contacts` sees zero rows belonging to Org B
result: [pending]

### 2. JWT claim population after trigger
expected: After inserting into `organization_members` and calling `supabase.auth.refreshSession()`, the decoded JWT contains `app_metadata.organization_id`
result: [pending]

### 3. Old blind policies removed
expected: `SELECT policyname FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'authenticated_%'` returns 0 rows
result: [pending]

### 4. gmail_tokens cross-user isolation
expected: User B cannot read or write User A's row in `gmail_tokens`
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
