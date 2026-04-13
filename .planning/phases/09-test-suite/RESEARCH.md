# Phase 09: Test Suite — Research

**Researched:** 2026-04-09
**Domain:** Vitest + Testing Library + Zustand store testing + Zod schema testing + GitHub Actions CI
**Confidence:** HIGH

---

## Summary

The project already has a working Vitest 4.1.2 test infrastructure with 7 test files and 19 passing
tests covering the auth flow. The `vite.config.ts` already declares a `test` block (jsdom env,
globals, setupFiles pointing to `tests/setup.ts`). The setup file imports `@testing-library/jest-dom`.
All dev dependencies for testing are installed (`vitest`, `jsdom`, `@testing-library/react`,
`@testing-library/user-event`, `@testing-library/jest-dom`). The only missing package is
`@vitest/coverage-v8`.

The existing auth tests establish the canonical patterns for this project: inline `vi.mock` for
`../../src/lib/supabase`, `useStore.setState()` for pre-seeding state, and `vi.hoisted()` when
mock references are needed before module-level hoisting. These patterns MUST be followed for
consistency.

The three Zod schemas targeted (ContactForm, DealForm, ActivityForm) are defined inline inside
their respective component files — they are NOT exported from a shared schemas file. Phase 9.3
must either import them from the component file (awkward — the component has JSX side-effects) or
extract the schemas to a dedicated `src/lib/schemas/` module as a prerequisite step.

**Primary recommendation:** Follow the established `vi.mock('../../src/lib/supabase', ...)` pattern
already proven in the auth tests; extract inline Zod schemas to `src/lib/schemas/` before writing
schema tests; use `useStore.setState({ ... })` (Zustand's built-in test utility) to reset store
state in `beforeEach`.

---

## Current State of Test Infrastructure

| Item | State |
|------|-------|
| `vitest` | Installed — v4.1.2 |
| `@testing-library/react` | Installed — v16.3.2 |
| `@testing-library/user-event` | Installed — v14.6.1 |
| `@testing-library/jest-dom` | Installed — v6.9.1 |
| `jsdom` | Installed — v29.0.1 |
| `@vitest/coverage-v8` | NOT installed — latest is 4.1.4 |
| `vite.config.ts` test block | Present — jsdom, globals:true, setupFiles: `./tests/setup.ts` |
| `tests/setup.ts` | Present — imports `@testing-library/jest-dom` |
| `tests/__mocks__/supabase.ts` | Present — but uses old pattern (see Pitfalls) |
| Test files | 7 files, 19 tests, all passing |
| `.github/workflows/` | Does NOT exist — must be created |
| Path alias `@/*` in vitest | NOT configured in `vite.config.ts` test block |
| Coverage config | NOT configured |

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.1.2 | Test runner, vi.mock, vi.fn, vi.hoisted |
| @testing-library/react | ^16.3.2 | render, screen, fireEvent, waitFor |
| @testing-library/user-event | ^14.6.1 | userEvent for realistic events |
| @testing-library/jest-dom | ^6.9.1 | expect matchers (toBeInTheDocument, etc.) |
| jsdom | ^29.0.1 | DOM environment |

### To Install
| Library | Version | Purpose |
|---------|---------|---------|
| @vitest/coverage-v8 | ^4.1.4 | V8 coverage provider for `vitest run --coverage` |

**Installation:**
```bash
npm install -D @vitest/coverage-v8
```

---

## Architecture Patterns

### Pattern 1: Supabase Mock — Per-File vi.mock (canonical in this project)

The project's existing tests use inline `vi.mock` per test file, NOT the module-level
`tests/__mocks__/supabase.ts` file. The `__mocks__` file is never auto-loaded (Vitest requires
explicit `vi.mock(path)` calls; Jest's automatic `__mocks__` resolution does not apply here).
Stick with the inline pattern established in `tests/auth/authStore.test.ts`:

```typescript
// Source: tests/auth/authStore.test.ts (verified working)
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
  isSupabaseConfigured: true,
}))
```

Note that `contactsStore` and `dealsStore` use a fluent Supabase builder chain
(`.from().select().order()`, `.from().insert().select().single()`). Each builder method must
return `this` (mockReturnThis) EXCEPT the terminal method which returns a Promise. The
`vi.hoisted()` helper must be used when you need to reference mock functions in both the
`vi.mock` factory and inside test bodies.

### Pattern 2: Zustand Store Reset in beforeEach

Zustand v5 exposes `setState` on the store instance directly. No external reset utility is needed.

```typescript
// Source: tests/auth/authStore.test.ts (verified working)
beforeEach(() => {
  useContactsStore.setState({
    contacts: [],
    filters: { search: '', status: '', source: '', tags: [], assignedTo: '', dateFrom: '', dateTo: '' },
    selectedId: null,
    isLoading: false,
    error: null,
  })
})
```

For stores using `persist` middleware (authStore, settingsStore, emailStore, viewsStore,
attachmentsStore): `setState` still works. The persist layer writes to localStorage but jsdom
provides a localStorage implementation so there are no errors. Call
`localStorage.clear()` in `afterEach` or `beforeEach` to prevent persist state leaking between
tests if a persist store is being tested.

### Pattern 3: Testing Store Actions That Call Supabase

contactsStore and dealsStore check `isSupabaseConfigured` before calling Supabase. Because the
mock sets `isSupabaseConfigured: true`, Supabase calls WILL be triggered. The fluent chain mock
must handle every method in the chain or tests throw.

For `addContact` / `addDeal` (optimistic + async confirm), the test only needs to verify the
optimistic state change synchronously — the async Supabase `.then()` branch is fire-and-forget
and does not need to be awaited in unit tests unless you are testing rollback-on-error behavior.

```typescript
// Minimal working mock for contactsStore CRUD actions
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
```

Also mock `../../src/store/auditStore` since `addContact`, `updateContact`, `deleteContact` call
`useAuditStore.getState().logAction(...)`:

```typescript
vi.mock('../../src/store/auditStore', () => ({
  useAuditStore: {
    getState: vi.fn().mockReturnValue({ logAction: vi.fn() }),
  },
}))
```

For dealsStore, also mock `notificationsStore` (used by `moveDeal`):

```typescript
vi.mock('../../src/store/notificationsStore', () => ({
  useNotificationsStore: {
    getState: vi.fn().mockReturnValue({ notify: vi.fn() }),
  },
}))
```

### Pattern 4: Zod Schema Testing

The Zod schemas for ContactForm, DealForm, ActivityForm are currently defined as `const schema`
INSIDE their component `.tsx` files and are NOT exported. You cannot import them without importing
the React component (which drags in hooks, router context, etc.).

**Required prerequisite for Plan 9.3:** Extract each schema to `src/lib/schemas/` before writing
schema tests. Create:
- `src/lib/schemas/contact.ts` — export `contactSchema`
- `src/lib/schemas/deal.ts` — export `dealSchema`
- `src/lib/schemas/activity.ts` — export `activitySchema`

Update component imports to consume from there.

Zod v4 schema test pattern (note: project uses Zod **v4.3.6** — `.safeParse()` returns
`{ success, data, error }` shape, same as v3):

```typescript
// Source: Zod v4 official docs
import { contactSchema } from '../../src/lib/schemas/contact'

it('rejects missing firstName', () => {
  const result = contactSchema.safeParse({ firstName: '' })
  expect(result.success).toBe(false)
  if (!result.success) {
    const firstNameErr = result.error.issues.find(i => i.path[0] === 'firstName')
    expect(firstNameErr?.message).toBe('Nombre requerido')
  }
})

it('accepts valid payload', () => {
  const result = contactSchema.safeParse({
    firstName: 'Ana',
    lastName: 'García',
    email: 'ana@empresa.com',
    phone: '',
    jobTitle: '',
    companyId: '',
    status: 'prospect',
    source: 'website',
    assignedTo: 'user-1',
    notes: '',
  })
  expect(result.success).toBe(true)
})
```

**Zod v4 breaking change to be aware of:** In Zod v4 `.error.errors` was renamed to
`.error.issues`. The project's Zod version is 4.3.6 — use `.error.issues`, not `.error.errors`.

### Pattern 5: vite.config.ts — Complete Corrected Config

The current `vite.config.ts` is missing the path alias resolution for `@/*` in the test
environment, and is missing coverage config. The `include` glob also uses `tests/**` which is
correct for this project's layout. The config needs to add:

```typescript
// Source: Vitest official docs (verified against v4 API)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/store/**', 'src/utils/**', 'src/lib/schemas/**'],
      exclude: ['src/utils/seedData.ts'],
    },
  },
})
```

The `resolve.alias` must live at the top level (not inside `test`) — it applies to both Vite
builds and Vitest. Without it, any test file that uses `@/` imports will fail with
"Cannot find module '@/...'".

### Pattern 6: GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npx vitest run
```

Notes on this CI config:
- `npm ci` is correct (not `npm install`) — uses lockfile exactly
- `npx tsc --noEmit` uses the project's `tsconfig.json` which already has `"noEmit": true`
- No `.env` file is needed because Supabase is mocked in all tests
- `node-version: 22` matches local environment (Node 22.20.0)
- No coverage upload in CI — keep CI fast; coverage is a local dev command

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| DOM matchers | Custom assertion helpers | `@testing-library/jest-dom` (already installed) |
| Store state isolation | Manual store factories or module cache clearing | `useStore.setState({...})` in beforeEach |
| Supabase response simulation | Actual Supabase test instance | `vi.mock('../../src/lib/supabase', ...)` |
| Coverage reports | Custom coverage scripts | `@vitest/coverage-v8` with `vitest run --coverage` |

---

## Common Pitfalls

### Pitfall 1: tests/__mocks__/supabase.ts Is Not Auto-Loaded

**What goes wrong:** Developer assumes `tests/__mocks__/supabase.ts` is automatically used by all
tests (Jest behavior). In Vitest, `__mocks__` directory is not auto-resolved the same way — you
must call `vi.mock('path/to/module')` explicitly in each test file that needs mocking.

**Why it happens:** Jest has an automatic mocking resolution for `__mocks__` adjacent to
`node_modules` or alongside the source. Vitest supports this pattern for `node_modules` mocks only
(not for relative path mocks unless `vi.mock()` is called).

**How to avoid:** Every store test file must have an explicit `vi.mock('../../src/lib/supabase', () => ({ ... }))` call. The existing `tests/__mocks__/supabase.ts` file is currently unused dead code.

### Pitfall 2: Fluent Supabase Builder Chain Mock Must Be Complete

**What goes wrong:** `contactsStore.addContact()` calls
`supabase.from('contacts').insert({...}).select().single()`. If your mock only stubs `.from()` to
return `{ insert: vi.fn() }` but `.insert()` doesn't return `{ select: ... }`, the test throws
`TypeError: Cannot read properties of undefined (reading 'select')`.

**How to avoid:** Build the full mock chain for every terminal operation the store uses. See
Pattern 3 above for the complete mock structure.

### Pitfall 3: auditStore and notificationsStore Cause Errors if Not Mocked

**What goes wrong:** `contactsStore.addContact()` calls `useAuditStore.getState().logAction(...)`.
If `auditStore` tries to initialize and calls `supabase.from('audit_log')...` and that chain isn't
mocked, tests fail with unexpected mock call errors or network errors.

**How to avoid:** Mock both `auditStore` and `notificationsStore` in any test that invokes a
contactsStore or dealsStore action. See Pattern 3.

### Pitfall 4: persist Middleware + jsdom localStorage

**What goes wrong:** Stores using `persist` middleware (authStore, settingsStore) read/write to
`localStorage`. If multiple test files run in the same jsdom environment and share a store, stale
persisted state from one test file leaks into the next.

**Why it happens:** Vitest runs each test file in its own worker/context by default, so cross-file
contamination is rare. Within a single test file, tests share the same jsdom instance.

**How to avoid:** In `beforeEach` for any persist-store test, call `localStorage.clear()` AND
reset state with `useStore.setState({...})`. This is demonstrated in the existing `authStore.test.ts`
which calls `useAuthStore.setState({ currentUser: null, isLoadingAuth: true })` but not yet
`localStorage.clear()` (acceptable because authStore tests don't assert on persisted values).

### Pitfall 5: Zod v4 API Change — .errors → .issues

**What goes wrong:** Code written against Zod v3 docs uses `result.error.errors[0].message`. In
Zod v4, this property was renamed to `result.error.issues`.

**How to avoid:** Always use `result.error.issues` when writing schema tests in this project.
Confirmed: project is on `zod@4.3.6`.

### Pitfall 6: dealsStore.moveDeal Uses Dynamic import() for automationsStore

**What goes wrong:** `moveDeal` does `import('./automationsStore').then(...)` dynamically. In
tests, this dynamic import will attempt to load the real automationsStore, which may in turn call
supabase. The `catch(() => {})` silences errors but you may see vitest warnings about unhandled
promises.

**How to avoid:** Either mock `./automationsStore` statically in dealsStore tests, or accept the
silent catch. For unit tests focused on state shape, the automations branch is not critical.

---

## Schemas: What Exists vs. What to Create

| Schema | Current Location | Status | Action Required |
|--------|-----------------|--------|-----------------|
| Contact schema | `src/components/contacts/ContactForm.tsx` line 13, not exported | Inline only | Extract to `src/lib/schemas/contact.ts` |
| Deal schema | `src/components/deals/DealForm.tsx` line 13, not exported | Inline only | Extract to `src/lib/schemas/deal.ts` |
| Activity schema | `src/components/activities/ActivityForm.tsx` line 13, not exported | Inline only | Extract to `src/lib/schemas/activity.ts` |

**Schema definitions verified from source:**

ContactForm schema:
```typescript
const contactSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido'),
  lastName: z.string().min(1, 'Apellido requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string(),
  jobTitle: z.string(),
  companyId: z.string(),
  status: z.enum(['prospect', 'customer', 'churned']),
  source: z.enum(['website', 'referral', 'outbound', 'event', 'linkedin', 'other']),
  assignedTo: z.string().min(1, 'Asignado a requerido'),
  notes: z.string(),
})
```

DealForm schema:
```typescript
const dealSchema = z.object({
  title: z.string().min(1, 'Título requerido'),
  value: z.string().min(1, 'Valor requerido'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
  probability: z.string(),
  expectedCloseDate: z.string().min(1, 'Fecha requerida'),
  contactId: z.string(),
  companyId: z.string(),
  assignedTo: z.string().min(1, 'Requerido'),
  priority: z.enum(['low', 'medium', 'high']),
  source: z.string(),
  notes: z.string(),
})
```

ActivityForm schema:
```typescript
const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'note', 'task', 'linkedin']),
  subject: z.string().min(1, 'Asunto requerido'),
  description: z.string(),
  outcome: z.string(),
  dueDate: z.string(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  contactId: z.string(),
  dealId: z.string(),
  createdBy: z.string().min(1, 'Requerido'),
})
```

---

## Utility Tests: What's Testable

| Utility | Functions | Testable Without Mocks? |
|---------|-----------|-------------------------|
| `src/utils/formatters.ts` | `formatCurrency`, `formatDate`, `formatDateShort`, `formatRelativeDate`, `formatNumber`, `getInitials`, `truncate` | YES — pure functions, no deps |
| `src/utils/permissions.ts` | `hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `canAccessRoute`, `getPermissionsForRole` | YES — pure functions, no deps |
| `src/utils/followUpEngine.ts` | `generateFollowUpReminders` (public export — check file) | YES — pure functions over Contact/Activity arrays |

`formatters.ts` uses `date-fns` with Spanish locale. Tests that call `formatDate` will produce
Spanish month names ('ene', 'feb', etc.) — assert against those or use ISO date assertions.
`formatRelativeDate` produces relative strings that depend on the current date — prefer testing
`formatDate` and `formatDateShort` for deterministic assertions.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vite.config.ts` (test block) |
| Quick run command | `npx vitest run tests/stores/ tests/schemas/ tests/utils/` |
| Full suite command | `npx vitest run` |
| Coverage command | `npx vitest run --coverage` |

### Phase Requirements → Test Map
| Plan | Behavior | Test Type | File |
|------|----------|-----------|------|
| 9.1 | Vitest configured with coverage | Config | `vite.config.ts` update |
| 9.2 | contactsStore CRUD actions update state | Unit | `tests/stores/contactsStore.test.ts` |
| 9.2 | contactsStore.getFilteredContacts filters correctly | Unit | `tests/stores/contactsStore.test.ts` |
| 9.2 | dealsStore CRUD + moveDeal changes stage | Unit | `tests/stores/dealsStore.test.ts` |
| 9.2 | dealsStore.getFilteredDeals filters correctly | Unit | `tests/stores/dealsStore.test.ts` |
| 9.3 | Contact schema rejects empty firstName/lastName | Unit | `tests/schemas/contact.test.ts` |
| 9.3 | Contact schema rejects invalid email | Unit | `tests/schemas/contact.test.ts` |
| 9.3 | Deal schema rejects empty title/date/assignedTo | Unit | `tests/schemas/deal.test.ts` |
| 9.3 | Activity schema rejects empty subject/createdBy | Unit | `tests/schemas/activity.test.ts` |
| 9.4 | formatCurrency formats EUR correctly | Unit | `tests/utils/formatters.test.ts` |
| 9.4 | getInitials extracts 2-char initials | Unit | `tests/utils/formatters.test.ts` |
| 9.4 | hasPermission returns correct boolean per role | Unit | `tests/utils/permissions.test.ts` |
| 9.4 | canAccessRoute respects permissions | Unit | `tests/utils/permissions.test.ts` |
| 9.5 | CI runs tsc + vitest on push/PR | CI | `.github/workflows/ci.yml` |

### Wave 0 Gaps
- [ ] `tests/stores/` directory — does not exist
- [ ] `tests/schemas/` directory — does not exist
- [ ] `tests/utils/` directory — does not exist
- [ ] `src/lib/schemas/contact.ts` — schema not yet extracted
- [ ] `src/lib/schemas/deal.ts` — schema not yet extracted
- [ ] `src/lib/schemas/activity.ts` — schema not yet extracted
- [ ] `@vitest/coverage-v8` — not installed (`npm install -D @vitest/coverage-v8`)
- [ ] `.github/workflows/` directory — does not exist

---

## Environment Availability

| Dependency | Required By | Available | Version |
|------------|------------|-----------|---------|
| Node.js | All | ✓ | 22.20.0 |
| npm | Install step | ✓ | (bundled with Node) |
| vitest | Test runner | ✓ | 4.1.2 |
| @vitest/coverage-v8 | Coverage reports | ✗ | — |
| GitHub Actions | CI (9.5) | N/A — remote | — |

**Missing dependencies:**
- `@vitest/coverage-v8` — blocks `vitest run --coverage`. Install with `npm install -D @vitest/coverage-v8`.

---

## Sources

### Primary (HIGH confidence)
- Verified directly from project source files in `tests/`, `src/store/`, `src/utils/`, `src/components/`
- `package.json` — confirmed installed versions
- `vite.config.ts` — confirmed current test config
- `tests/auth/authStore.test.ts` — canonical mock pattern used in this project

### Secondary (MEDIUM confidence)
- Vitest v4 docs — coverage config, path alias behavior
- Zod v4 changelog — `.errors` → `.issues` rename

---

## Metadata

**Confidence breakdown:**
- Current infrastructure state: HIGH — read directly from files, ran test suite
- Supabase mock pattern: HIGH — proven by 19 passing tests in this repo
- Zustand reset pattern: HIGH — `setState` verified in existing authStore tests
- Zod v4 `.issues` API: HIGH — confirmed by project's zod@4.3.6 dependency
- GitHub Actions yml: MEDIUM — standard pattern, no project-specific quirks expected
- `automationsStore` dynamic import side-effect: MEDIUM — code inspected, behavior inferred

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable ecosystem — no fast-moving dependencies)
