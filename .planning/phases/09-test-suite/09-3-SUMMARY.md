---
phase: 09-test-suite
plan: 3
title: Extract Zod Schemas + Write Schema Tests
subsystem: validation
tags: [zod, schemas, testing, vitest, forms]
dependency-graph:
  requires: [09-1]
  provides: [src/lib/schemas/contact.ts, src/lib/schemas/deal.ts, src/lib/schemas/activity.ts]
  affects: [ContactForm, DealForm, ActivityForm]
tech-stack:
  added: [src/lib/schemas/]
  patterns: [schema extraction, Zod v4 safeParse with .error.issues]
key-files:
  created:
    - src/lib/schemas/contact.ts
    - src/lib/schemas/deal.ts
    - src/lib/schemas/activity.ts
    - tests/schemas/contact.test.ts
    - tests/schemas/deal.test.ts
    - tests/schemas/activity.test.ts
  modified:
    - src/components/contacts/ContactForm.tsx
    - src/components/deals/DealForm.tsx
    - src/components/activities/ActivityForm.tsx
decisions:
  - Used named export matching the schema's semantic name (contactSchema, dealSchema, activitySchema) rather than keeping the local `schema` alias
  - Kept `import { z } from 'zod'` in component files since z is still referenced for z.infer
metrics:
  duration: ~10 minutes
  completed: 2026-04-09
  tasks: 3
  files: 9
---

# Phase 09 Plan 3: Extract Zod Schemas + Write Schema Tests Summary

## One-liner

Extracted three inline Zod schemas from form components into `src/lib/schemas/`, updated component imports, and added 17 schema unit tests using Zod v4 `.error.issues` API.

## What Was Built

The ContactForm, DealForm, and ActivityForm components each had an unexported local `schema` const preventing test isolation. Each schema was extracted to a dedicated file with a named export and inferred TypeScript type. Each component was updated to import its schema. Three test files were created covering valid payloads and required-field violations using Spanish error messages.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extract schemas to src/lib/schemas/ | ab95f01e | contact.ts, deal.ts, activity.ts |
| 2 | Update component imports | ab95f01e | ContactForm.tsx, DealForm.tsx, ActivityForm.tsx |
| 3 | Write schema tests | ab95f01e | tests/schemas/contact.test.ts, deal.test.ts, activity.test.ts |

## Verification Results

- `npx tsc --noEmit`: 0 errors
- `npx vitest run tests/schemas/`: 3 test files, 17 tests — all passed
- Full suite: 101 tests passing (pre-existing failures in Register.test.tsx and contactsStore.test.ts are unrelated to this plan)

## Deviations from Plan

None — plan executed exactly as written. The component files used `schema` as the local variable name (not `contactSchema` etc.), which was handled by renaming to match the exported name upon import, and updating the `zodResolver(schema)` call accordingly.

## Known Stubs

None.

## Self-Check: PASSED

- src/lib/schemas/contact.ts: FOUND
- src/lib/schemas/deal.ts: FOUND
- src/lib/schemas/activity.ts: FOUND
- tests/schemas/contact.test.ts: FOUND
- tests/schemas/deal.test.ts: FOUND
- tests/schemas/activity.test.ts: FOUND
- Commit ab95f01e: FOUND
