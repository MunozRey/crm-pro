---
phase: 09-test-suite
plan: 4
title: "Utility Tests"
goal: "Write unit tests for followUpEngine, formatters, and permissions utilities — all pure functions that require no mocks."
wave: 2
dependencies: [1]
requirements: [TEST-04]
---

# Plan 09-4: Utility Tests

## Goal

Write tests for the three pure-function utility modules: `src/utils/followUpEngine.ts`, `src/utils/formatters.ts`, and `src/utils/permissions.ts`. These require no Supabase mocks or store setup — they are simple input/output functions.

## Context

All three utilities are pure functions verified in the research phase:

- `src/utils/formatters.ts` — exports `formatCurrency`, `formatDate`, `formatDateShort`, `formatRelativeDate`, `formatNumber`, `getInitials`, `truncate`. Uses `date-fns` with Spanish locale; `formatDate` and `formatDateShort` produce Spanish month names ('ene', 'feb', etc.) — assertions must match Spanish output. Avoid asserting `formatRelativeDate` since it depends on the current date.

- `src/utils/permissions.ts` — exports `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `canAccessRoute`, `getPermissionsForRole`. Pure role/permission lookups — no side effects.

- `src/utils/followUpEngine.ts` — exports `generateFollowUpReminders` (verify the actual exported function name by reading the file before writing tests). Takes Contact and Activity arrays, returns reminder objects.

The `tests/utils/` directory does not exist yet — create it as part of this plan.

Before writing any assertions, read each utility file to confirm exact export names, function signatures, and expected output values. The task actions below describe what to test; the exact assertion values depend on the actual implementation.

## Tasks

### Task 1: Write formatters.test.ts

Read `src/utils/formatters.ts` to identify the exact exports and their behavior. Then create `tests/utils/formatters.test.ts`.

Required test cases (adjust expected values by reading the actual implementation):

**formatCurrency**
- Calling `formatCurrency(1000, 'EUR')` should return a string containing '1' and some number formatting. Assert it includes the euro symbol or 'EUR' based on what the function actually returns.
- Calling `formatCurrency(0, 'USD')` should return a formatted zero value (e.g. `'$0.00'` or `'0 USD'` — check actual output).
- If the function accepts a locale parameter, test with the default locale.

**formatDate** (date-fns with Spanish locale)
- Call `formatDate('2026-01-15')` and assert the result contains 'ene' (Spanish for January) and '2026'. Do not assert the exact full string without first running the function — the format may be `'15 ene 2026'` or `'ene 15, 2026'`.
- Call `formatDate('2026-06-01')` and assert result contains 'jun'.

**getInitials**
- `getInitials('Ana García')` should return `'AG'`
- `getInitials('Carlos')` should return `'C'`
- `getInitials('')` should return `''` or a safe fallback — verify by reading the source

**truncate**
- `truncate('Hello World', 5)` should return `'Hello...'` or similar — verify the exact truncation behavior (with or without ellipsis, exact suffix) from the source
- `truncate('Hi', 10)` should return `'Hi'` (no truncation when shorter than limit)

**formatNumber**
- `formatNumber(1234567)` should return a string with thousand separators — check whether it uses periods or commas based on the Spanish locale

Do not test `formatRelativeDate` — it depends on `Date.now()` and produces non-deterministic output.

File: `tests/utils/formatters.test.ts`

### Task 2: Write permissions.test.ts

Read `src/utils/permissions.ts` to identify all exported functions and the role/permission definitions used in this project. Then create `tests/utils/permissions.test.ts`.

Required test cases:

**hasPermission**
- Test that the `'admin'` role has a permission that should be admin-only (e.g., `'delete_contacts'` or `'manage_users'` — read the file to find the correct permission name).
- Test that the `'member'` role does NOT have that same admin-only permission.
- Test that `'member'` role DOES have a read permission (e.g., `'view_contacts'` or `'read_contacts'`).

**canAccessRoute**
- Test that `'admin'` can access a protected route (e.g., `/settings/users` or `/admin` — check what routes are defined in the permissions file).
- Test that `'member'` cannot access that same protected route.
- Test that any role can access a public route like `/dashboard` or `/contacts` (if such a route is in the permissions map).

**getPermissionsForRole**
- Test that calling `getPermissionsForRole('admin')` returns an array.
- Test that calling `getPermissionsForRole('admin')` returns more permissions than `getPermissionsForRole('member')`.
- Test that `getPermissionsForRole('unknown_role')` returns an empty array (or whatever the fallback is — read the source).

**hasAnyPermission and hasAllPermissions** (if these differ meaningfully from hasPermission):
- `hasAnyPermission('member', ['delete_contacts', 'view_contacts'])` — member can view but not delete, so this should return `true` (has at least one).
- `hasAllPermissions('member', ['delete_contacts', 'view_contacts'])` — should return `false` (member doesn't have delete).

All permission names and role names must be taken from the actual `src/utils/permissions.ts` source. Do not invent names.

File: `tests/utils/permissions.test.ts`

### Task 3: Write followUpEngine.test.ts

Read `src/utils/followUpEngine.ts` to identify the exact exported function(s) and the shape of the input/output types. Then create `tests/utils/followUpEngine.test.ts`.

The function is expected to be `generateFollowUpReminders(contacts, activities)` or similar. Verify the actual name and signature from the file.

Required test cases:

**No reminders when contacts have recent activity**
- Create a contact with a recent `updatedAt` or a recent activity within the follow-up threshold (whatever the engine's threshold is — read the source to find the constant).
- Assert that `generateFollowUpReminders([contact], [recentActivity])` returns an empty array or zero reminders for that contact.

**Reminder generated for stale contact**
- Create a contact with no activities and an `updatedAt` date far in the past (e.g., 60 days ago).
- Assert that the function returns at least one reminder object with the contact's id.

**Reminder object shape**
- Assert that each returned reminder has at least a `contactId` field (or whatever field the actual return type uses — read the source).

**Empty inputs**
- `generateFollowUpReminders([], [])` should return `[]`.

Build the minimal contact/activity objects that satisfy the function's type requirements by reading the actual type definitions.

File: `tests/utils/followUpEngine.test.ts`

## Verification

Run utility tests in isolation:

```bash
cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run tests/utils/
```

Expected: all utility tests pass, exit code 0.

Run full suite to confirm no regressions:

```bash
cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run
```

Expected: all tests pass, 0 failed.

## Success Criteria

- `tests/utils/formatters.test.ts` exists and covers formatCurrency, formatDate (Spanish month names), getInitials, truncate, formatNumber
- `tests/utils/permissions.test.ts` exists and covers hasPermission, canAccessRoute, getPermissionsForRole with at least two roles tested
- `tests/utils/followUpEngine.test.ts` exists and covers the happy path (stale contact gets reminder), the no-op path (recent contact gets no reminder), and empty inputs
- All utility tests pass without any vi.mock calls (pure functions, no mocks needed)
- Full suite exits 0 (no regressions)
