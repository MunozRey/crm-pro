---
phase: 09-test-suite
plan: 2
title: "Zustand Store Tests"
goal: "Write unit tests for contactsStore and dealsStore CRUD actions and filtered selectors using the inline vi.mock pattern established by existing auth tests."
wave: 2
dependencies: [1]
requirements: [TEST-02]
---

# Plan 09-2: Zustand Store Tests

## Goal

Write `tests/stores/contactsStore.test.ts` and `tests/stores/dealsStore.test.ts`. Cover the four CRUD actions in each store plus the `getFilteredContacts` / `getFilteredDeals` selector functions. Use the project's canonical `vi.mock` per-file pattern — no shared `__mocks__` file.

## Context

The stores live at `src/store/contactsStore.ts` and `src/store/dealsStore.ts`. Both use a fluent Supabase builder chain. Their actions call `useAuditStore.getState().logAction()` on every mutation; `dealsStore.moveDeal` additionally calls `useNotificationsStore.getState().notify()`. All three cross-store calls must be mocked or the tests throw.

The `tests/stores/` directory does not exist yet — create it as part of this plan.

The reset pattern for Zustand v5 is `useStore.setState({ ...initialState })` in `beforeEach`. No external reset utility is needed.

The existing `tests/__mocks__/supabase.ts` is dead code and is NOT used here. Every test file declares its own `vi.mock('../../src/lib/supabase', ...)`.

## Tasks

### Task 1: Write contactsStore.test.ts

Create `tests/stores/contactsStore.test.ts`.

The file must:

1. Mock supabase with the full fluent chain needed by contactsStore:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContactsStore } from '../../src/store/contactsStore'

const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockOrder = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: mockFrom.mockReturnValue({
      select: mockSelect.mockReturnValue({
        order: mockOrder.mockResolvedValue({ data: [], error: null }),
      }),
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle.mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockResolvedValue({ data: null, error: null }),
      }),
      delete: mockDelete.mockReturnValue({
        eq: mockEq.mockResolvedValue({ data: null, error: null }),
      }),
    }),
  },
}))

vi.mock('../../src/store/auditStore', () => ({
  useAuditStore: {
    getState: vi.fn().mockReturnValue({ logAction: vi.fn() }),
  },
}))
```

2. Reset store state in `beforeEach`:

```typescript
beforeEach(() => {
  useContactsStore.setState({
    contacts: [],
    filters: {
      search: '',
      status: '',
      source: '',
      tags: [],
      assignedTo: '',
      dateFrom: '',
      dateTo: '',
    },
    selectedId: null,
    isLoading: false,
    error: null,
  })
  vi.clearAllMocks()
})
```

3. Write test cases covering:

- `addContact` — call `useContactsStore.getState().addContact(payload)` where payload is a minimal valid contact object (firstName, lastName, email, status: 'prospect', source: 'website', assignedTo: 'user-1'). Assert the contacts array length increases by 1 synchronously (optimistic update).

- `updateContact` — seed one contact via `useContactsStore.setState({ contacts: [sampleContact] })`, call `updateContact(id, { firstName: 'Updated' })`, assert the contact's firstName changed to 'Updated'.

- `deleteContact` — seed one contact, call `deleteContact(id)`, assert contacts array is empty.

- `getFilteredContacts` — seed three contacts with different statuses ('prospect', 'customer', 'churned'). Set filter `{ status: 'prospect' }` via `useContactsStore.setState({ filters: { ...emptyFilters, status: 'prospect' } })`. Call `useContactsStore.getState().getFilteredContacts()`. Assert only the 'prospect' contact is returned. Then test the `search` filter: seed two contacts with different names, set filter `{ search: 'Ana' }`, assert only the matching contact is returned.

For the sample contact object, use:
```typescript
const sampleContact = {
  id: 'c-1',
  firstName: 'Ana',
  lastName: 'García',
  email: 'ana@test.com',
  phone: '',
  jobTitle: '',
  companyId: '',
  status: 'prospect' as const,
  source: 'website' as const,
  assignedTo: 'user-1',
  tags: [],
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  organizationId: 'org-1',
}
```

Adjust field names if the actual store type uses camelCase differently — read `src/store/contactsStore.ts` to confirm the Contact interface field names before writing assertions.

File: `tests/stores/contactsStore.test.ts`

### Task 2: Write dealsStore.test.ts

Create `tests/stores/dealsStore.test.ts`.

The file must mock three modules:

```typescript
vi.mock('../../src/lib/supabase', () => ({ /* same full chain as above */ }))

vi.mock('../../src/store/auditStore', () => ({
  useAuditStore: {
    getState: vi.fn().mockReturnValue({ logAction: vi.fn() }),
  },
}))

vi.mock('../../src/store/notificationsStore', () => ({
  useNotificationsStore: {
    getState: vi.fn().mockReturnValue({ notify: vi.fn() }),
  },
}))
```

Also add a static mock for `automationsStore` to prevent its dynamic import from hitting real Supabase:

```typescript
vi.mock('../../src/store/automationsStore', () => ({
  useAutomationsStore: {
    getState: vi.fn().mockReturnValue({ triggerAutomation: vi.fn() }),
  },
}))
```

Reset in `beforeEach`:

```typescript
beforeEach(() => {
  useDealsStore.setState({
    deals: [],
    filters: {
      search: '',
      stage: '',
      assignedTo: '',
      priority: '',
      dateFrom: '',
      dateTo: '',
    },
    selectedId: null,
    isLoading: false,
    error: null,
  })
  vi.clearAllMocks()
})
```

Adjust the initial state shape to match the actual `useDealsStore` state definition — read `src/store/dealsStore.ts` to confirm field names.

Write test cases covering:

- `addDeal` — call `useDealsStore.getState().addDeal(payload)` with a minimal valid deal object. Assert deals array length increases by 1.

- `updateDeal` — seed one deal, call `updateDeal(id, { title: 'Renamed' })`, assert title changed.

- `moveDeal` — seed one deal in stage `'lead'`, call `moveDeal(id, 'qualified')`, assert the deal's stage is now `'qualified'`.

- `getFilteredDeals` — seed two deals with different stages. Apply a stage filter. Assert only the matching deal is returned. Also test the search filter on `title`.

For the sample deal:
```typescript
const sampleDeal = {
  id: 'd-1',
  title: 'Big Contract',
  value: 5000,
  currency: 'EUR' as const,
  stage: 'lead' as const,
  probability: 20,
  expectedCloseDate: '2026-06-01',
  contactId: '',
  companyId: '',
  assignedTo: 'user-1',
  priority: 'medium' as const,
  source: '',
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  organizationId: 'org-1',
}
```

Adjust field types as needed after reading the actual Deal type in `src/store/dealsStore.ts` or `src/types/index.ts`.

File: `tests/stores/dealsStore.test.ts`

## Verification

Run only the store tests to confirm they pass without touching the existing 19 tests:

```bash
cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run tests/stores/
```

Expected: all tests in both files pass, exit code 0.

Then run the full suite to confirm nothing was broken:

```bash
cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run
```

Expected: previous 19 tests plus all new store tests pass, 0 failed.

## Success Criteria

- `tests/stores/contactsStore.test.ts` exists and covers addContact, updateContact, deleteContact, getFilteredContacts (status filter + search filter)
- `tests/stores/dealsStore.test.ts` exists and covers addDeal, updateDeal, moveDeal, getFilteredDeals (stage filter + search filter)
- All store tests pass in isolation (`npx vitest run tests/stores/`)
- Full suite still exits 0 (no regressions in existing 19 tests)
- No test file imports from `tests/__mocks__/supabase.ts` — each file declares its own `vi.mock`
