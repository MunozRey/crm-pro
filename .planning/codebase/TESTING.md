# Testing Patterns

**Analysis Date:** 2026-03-31

## Test Framework

**Runner:** None configured

**Assertion Library:** None

**Test files found:** 0

No test runner, test framework, or test files exist in this codebase. The `package.json` contains no test script, no `vitest`, `jest`, `@testing-library/*`, `playwright`, or `cypress` dependencies (neither in `dependencies` nor `devDependencies`).

```json
// package.json scripts — no test command present
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

## Test File Organization

**No test files exist.** A search for `*.test.*` and `*.spec.*` files returned zero results across the entire codebase.

## Current Quality Safeguards

While there are no automated tests, TypeScript strict mode provides compile-time safety:

- `"strict": true` — enables all strict type checks
- `"noFallthroughCasesInSwitch": true` — prevents switch fallthrough bugs
- `tsc` runs as part of the build: `"build": "tsc && vite build"` — TypeScript errors block production builds

The TypeScript configuration in `tsconfig.json` is the only automated correctness check in place.

## Code Testability Assessment

**Well-suited for unit testing:**

- `src/utils/formatters.ts` — pure functions with no side effects: `formatCurrency`, `formatDate`, `formatRelativeDate`, `getInitials`, `truncate`
- `src/utils/leadScoring.ts` — deterministic scoring logic: `computeLeadScore`, `calculateLeadScore`
- `src/utils/permissions.ts` — pure lookup functions: `hasPermission`, `hasAnyPermission`, `canAccessRoute`
- `src/utils/dealHealth.ts` — pure computation
- `src/utils/followUpEngine.ts` — pure computation
- `src/utils/duplicateDetection.ts` — pure computation
- `src/hooks/useFilters.ts` — simple state hook testable with `renderHook`
- `src/hooks/useSearch.ts` — pure filtering logic via `useMemo`, testable with `renderHook`

**Moderately suited (requires mocking):**

- `src/store/contactsStore.ts` — Zustand stores can be tested by resetting state between tests
- `src/store/dealsStore.ts` — cross-store calls (`useAuditStore.getState()`) need mocking
- `src/hooks/useLocalStorage.ts` — requires `localStorage` mock (`jest.spyOn(window.localStorage, ...)` or `vitest`'s `vi.spyOn`)
- Form components (`src/components/contacts/ContactForm.tsx`, etc.) — testable with `@testing-library/react` + `userEvent`

**Hard to test without significant refactoring:**

- `src/store/authStore.ts` — contains a hardcoded `simpleHash` function used for password comparison; mixing auth logic with store state makes isolation difficult
- `src/store/dealsStore.ts` `moveDeal` action — dynamic `import('./automationsStore')` inside an action makes it difficult to intercept in tests
- `src/services/aiService.ts` — depends on `@anthropic-ai/sdk` network calls
- `src/services/gmailService.ts` — depends on OAuth and Gmail API

## Recommended Test Setup (if testing is added)

**Recommended framework stack:**
- `vitest` — native Vite integration, no config overhead
- `@testing-library/react` — component testing
- `@testing-library/user-event` — interaction simulation
- `jsdom` — browser environment for Vitest

**Minimal `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

**Recommended file placement:** Co-locate test files next to source files:
```
src/utils/formatters.ts
src/utils/formatters.test.ts
src/hooks/useFilters.ts
src/hooks/useFilters.test.ts
```

**Example unit test pattern for pure utils:**
```typescript
// src/utils/formatters.test.ts
import { describe, it, expect } from 'vitest'
import { formatCurrency, getInitials, truncate } from './formatters'

describe('formatCurrency', () => {
  it('formats EUR values with locale', () => {
    expect(formatCurrency(1500, 'EUR')).toBe('1.500 €')
  })
})

describe('getInitials', () => {
  it('returns first two initials uppercased', () => {
    expect(getInitials('David Muñoz')).toBe('DM')
  })
})
```

**Example Zustand store test pattern:**
```typescript
// src/store/contactsStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useContactsStore } from './contactsStore'

beforeEach(() => {
  useContactsStore.setState({ contacts: [], filters: defaultFilters })
})

it('adds a contact and assigns an id', () => {
  const store = useContactsStore.getState()
  const contact = store.addContact({ firstName: 'Test', ... })
  expect(contact.id).toBeTruthy()
  expect(useContactsStore.getState().contacts).toHaveLength(1)
})
```

## Coverage Gaps (if testing were added)

**High priority — business logic with no tests:**
- Lead scoring algorithm in `src/utils/leadScoring.ts` — complex branching logic
- Deal health computation in `src/utils/dealHealth.ts`
- Follow-up urgency logic in `src/utils/followUpEngine.ts`
- Duplicate detection matching in `src/utils/duplicateDetection.ts`
- Permission system in `src/utils/permissions.ts` — security-critical

**Medium priority:**
- Store CRUD operations (add/update/delete/filter) across all entity stores
- `useFilters` and `useSearch` hooks
- Form validation schema correctness (Zod schemas in form components)

**Lower priority:**
- UI rendering of primitive components (`Button`, `Badge`, `Avatar`)
- Page-level components (high mocking overhead, low logic density)

---

*Testing analysis: 2026-03-31*
