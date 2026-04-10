---
phase: 09-test-suite
plan: 2
title: Zustand Store Tests
subsystem: testing
tags: [vitest, zustand, unit-tests, contactsStore, dealsStore]
key-files:
  created:
    - tests/stores/contactsStore.test.ts
    - tests/stores/dealsStore.test.ts
decisions:
  - Used vi.mock factory with inline vi.fn() definitions (no top-level variables) to avoid vi.mock hoisting issues
  - Moved serverContact/serverDeal data inside vi.mock factory to avoid "Cannot access before initialization" error
  - Avoided vi.clearAllMocks() to prevent resetting mock return values set up at module init time
  - Used separate mockSelectForInsert and mockSelectForFetch to avoid shared mockSelect being cleared between calls
metrics:
  duration: ~25 minutes
  completed: 2026-04-09
  tasks: 2
  files: 2
---

# Phase 09 Plan 2: Zustand Store Tests Summary

One-liner: Unit tests for contactsStore and dealsStore covering optimistic CRUD mutations and filtered selectors using per-file vi.mock inline factories.

## What Was Built

Created `tests/stores/` directory with two test files:

- `tests/stores/contactsStore.test.ts` — 5 tests covering addContact (optimistic), updateContact, deleteContact, getFilteredContacts (status filter + name search filter)
- `tests/stores/dealsStore.test.ts` — 5 tests covering addDeal (optimistic), updateDeal, moveDeal stage transition, getFilteredDeals (stage filter + title search filter)

## Test Results

- Store tests: 10/10 passed, exit code 0, no unhandled rejections
- Full suite: 100/101 passed — the 1 pre-existing failure in `tests/auth/Register.test.tsx` (AUTH-02) was confirmed to exist before this plan's changes (searches for English "check your email" but UI shows Spanish "Revisa tu correo")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock factory hoisting prevented top-level mock variable references**
- Found during: Task 1 and Task 2 execution
- Issue: `vi.mock()` is hoisted to top of file, so `const mockFrom = vi.fn()` declared above it cannot be referenced inside the factory — results in "Cannot access before initialization" ReferenceError
- Fix: Moved all mock function definitions inside the `vi.mock(() => { ... })` factory body directly, without referencing outer-scope variables. Also moved `serverContact`/`serverDeal` data objects inside the factory for the same reason.
- Files modified: tests/stores/contactsStore.test.ts, tests/stores/dealsStore.test.ts

**2. [Rule 1 - Bug] Shared mockSelect across insert and fetch chains caused unhandled rejection**
- Found during: Task 1 verification
- Issue: Plan's suggested mock structure reused `mockSelect` in both `select().order()` and `insert().select().single()` chains. After `vi.clearAllMocks()`, the shared mock lost its return value for the second invocation, causing `rowToContact(null)` to throw an unhandled rejection.
- Fix: Used separate `mockSelectForFetch` and `mockSelectForInsert` mocks; removed `vi.clearAllMocks()` from `beforeEach` (store state reset via `setState` is sufficient).

## Known Stubs

None.

## Self-Check: PASSED

- tests/stores/contactsStore.test.ts: EXISTS
- tests/stores/dealsStore.test.ts: EXISTS
- Commit b199e432: EXISTS
