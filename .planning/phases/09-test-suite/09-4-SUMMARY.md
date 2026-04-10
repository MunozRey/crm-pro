> [!NOTE]
> Historical snapshot: this phase file is kept for audit/history and may be outdated.
> Source of truth for current status and priorities: `.planning/STATE.md` and `.planning/ROADMAP.md`.

> [!NOTE]
> Historical snapshot: this phase document is preserved for implementation history.
> Source of truth for current status and priorities:  and .

> **Historical Snapshot:** This phase document is retained for historical context. Current source of truth is `.planning/STATE.md` and `.planning/ROADMAP.md`.

---
phase: 09-test-suite
plan: 4
title: Utility Tests
subsystem: tests
tags: [vitest, unit-tests, formatters, permissions, followUpEngine]
dependency_graph:
  requires: [09-1]
  provides: [utility-test-coverage]
  affects: []
tech_stack:
  added: []
  patterns: [pure-function-unit-tests, no-mocks]
key_files:
  created:
    - tests/utils/formatters.test.ts
    - tests/utils/permissions.test.ts
    - tests/utils/followUpEngine.test.ts
  modified: []
decisions:
  - Used `getFollowUpReminders` (actual export name) not `generateFollowUpReminders` as the plan suggested — confirmed by reading source
  - Truncate uses unicode ellipsis U+2026 not three dots — matched exact character from source
  - formatNumber with es-ES locale uses period as thousand separator — asserted exact output '1.234.567'
metrics:
  duration: ~8 minutes
  completed_date: 2026-04-09
  tasks_completed: 3
  files_created: 3
---

# Phase 09 Plan 4: Utility Tests Summary

Pure-function unit tests for `formatters`, `permissions`, and `followUpEngine` — 55 tests, 3 files, zero mocks.

## What Was Built

Three test files covering all pure utility modules:

- `tests/utils/formatters.test.ts` — 20 tests covering `formatCurrency` (EUR/USD defaults), `formatDate` (Spanish month names: ene, jun, mar), `formatDateShort` (dd/MM/yyyy), `formatNumber` (es-ES thousand separators), `getInitials` (1-2 words), `truncate` (unicode ellipsis U+2026)
- `tests/utils/permissions.test.ts` — 21 tests covering `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `canAccessRoute`, `getPermissionsForRole` across all four roles (admin, manager, sales_rep, viewer)
- `tests/utils/followUpEngine.test.ts` — 14 tests covering empty inputs, recent activity (no reminder), stale contact (reminder generated), urgency levels (critical/high), sorting, company name resolution, churned contact skip, reminder object shape

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected function name: getFollowUpReminders not generateFollowUpReminders**
- **Found during:** Task 3 — reading the source file
- **Issue:** Plan referred to the function as `generateFollowUpReminders` but the actual export is `getFollowUpReminders`
- **Fix:** Used the correct name `getFollowUpReminders` in tests
- **Files modified:** tests/utils/followUpEngine.test.ts

**2. [Rule 1 - Correctness] getFollowUpReminders takes a third `companies` parameter**
- **Found during:** Task 3 — reading the source signature
- **Issue:** Plan described a two-argument signature `(contacts, activities)` but the actual function is `(contacts, activities, companies)`
- **Fix:** Added `companies` array (with `baseCompany` fixture) to all test calls
- **Files modified:** tests/utils/followUpEngine.test.ts

## Pre-existing Failures (Out of Scope)

Two tests in other files were already failing before this plan:
- `tests/auth/Register.test.tsx > AUTH-02` — looks for English text "check your email" but UI renders Spanish "Revisa tu correo"
- `tests/stores/contactsStore.test.ts > filters by search term on name` — filter returns 2 results instead of 1

These are not caused by plan 09-4 changes and are deferred.

## Known Stubs

None.

## Self-Check: PASSED

- tests/utils/formatters.test.ts — exists, 20 tests pass
- tests/utils/permissions.test.ts — exists, 21 tests pass
- tests/utils/followUpEngine.test.ts — exists, 14 tests pass
- Commit 4957355c — verified
