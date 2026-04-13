# Deploy + Testing Research: CRM Pro

**Topic:** Vercel deployment + Vitest testing for Vite + React + TypeScript SaaS
**Researched:** 2026-03-31
**Overall confidence:** HIGH (Vercel — official docs verified), MEDIUM (Vitest/testing — training knowledge, Vitest docs inaccessible during research)

---

## 1. Vercel Deployment for Vite 8 SPA

### Confidence: HIGH (official Vercel docs verified)

Vite is a first-class citizen on Vercel. The build framework is auto-detected when a `vite.config.ts` is present. No `vercel.json` is required for basic deployments, but SPAs with client-side routing REQUIRE a rewrite rule.

### vercel.json — Required for React Router

This project uses `react-router-dom` v6 with client-side routing. Without a rewrite rule, any URL deeper than `/` will return a 404 on direct load or refresh. The fix is mandatory:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Place this file at the repository root alongside `package.json`. This is the only config needed for a pure SPA — Vercel auto-detects the Vite framework, runs `tsc && vite build`, and serves `dist/`.

**Note on `cleanUrls`:** If you later enable `"cleanUrls": true` in vercel.json, change the destination to `"/"` (no `.html` extension). Do not combine both at once.

### Build settings (auto-detected, but explicit is safer)

Vercel will infer these from the Vite preset, but you can lock them in Project Settings:

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Build Command | `tsc && vite build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |

### Preview deployments

Every push to a non-`main` branch automatically gets a preview URL in the format `crm-app-git-[branch-name]-[team].vercel.app`. Vercel posts a comment on PRs with the link. This is on by default — no configuration required.

To silence the PR bot comments: Project Settings > Git > disable "Comment on Pull Requests".

### Custom domain

Adding a custom domain (e.g., `app.yourdomain.com`) requires DNS configuration at your registrar:

- **Subdomain** (`app.yourdomain.com`): Add a `CNAME` record pointing to Vercel's unique CNAME for your project (shown in Project Settings > Domains after adding the domain).
- **Apex domain** (`yourdomain.com`): Add an `A` record pointing to `76.76.21.21` (Vercel's IP). Vercel recommends also adding `www` as a redirect.

The Vercel dashboard shows the exact records needed for your project. DNS propagation takes 1-24 hours. After propagation Vercel auto-provisions a TLS certificate.

---

## 2. Supabase Environment Variables on Vercel

### Confidence: HIGH

The project already uses the correct Vite env var naming convention (`VITE_` prefix = bundled into client). The `src/lib/supabase.ts` pattern confirms: the app works without Supabase (graceful `null` fallback), which makes the env vars optional but required for full functionality.

### Variable classification

| Variable | Type | Public? | Why |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Public | YES — safe to expose | It is just the project URL, not a secret. Required by the JS client. |
| `VITE_SUPABASE_ANON_KEY` | Public | YES — safe to expose | The anon key is designed to be public. Row Level Security (RLS) is what protects data, not key secrecy. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | NO — never expose | Server-side only. Bypasses RLS entirely. Never use with `VITE_` prefix. Never expose to the client. |

The project does NOT currently use the service role key, which is correct for a client-side app. Only ever add `SUPABASE_SERVICE_ROLE_KEY` to Vercel Functions (server-side), never as a `VITE_` variable.

### Setting env vars in Vercel

In the Vercel dashboard, go to Project Settings > Environment Variables:

```
Name:   VITE_SUPABASE_URL
Value:  https://your-project.supabase.co
Environments: Production, Preview, Development (check all three)

Name:   VITE_SUPABASE_ANON_KEY
Value:  eyJhbGci...
Environments: Production, Preview, Development (check all three)
```

**Per-environment scoping:** You can assign different values per environment. For preview deployments pointing to a Supabase staging project, assign the staging URL/key only to "Preview". This keeps production data isolated from preview testing.

### Environment management strategy

```
Production branch (main):
  VITE_SUPABASE_URL     → https://prod-project.supabase.co
  VITE_SUPABASE_ANON_KEY → prod anon key

Preview branches:
  VITE_SUPABASE_URL     → https://staging-project.supabase.co
  VITE_SUPABASE_ANON_KEY → staging anon key

Local development (.env.local):
  VITE_SUPABASE_URL     → https://staging-project.supabase.co (or local)
  VITE_SUPABASE_ANON_KEY → staging anon key
```

Pull env vars from Vercel to local with: `vercel env pull .env.local`

### Local env file rules

| File | Committed? | Purpose |
|---|---|---|
| `.env.local` | NO (gitignored) | Local dev secrets, overrides everything |
| `.env` | YES (if needed) | Non-secret defaults for all environments |
| `.env.production` | YES (if needed) | Non-secret production defaults |
| `.env.example` | YES | Template with placeholder values (already exists in this project) |

The existing `.env.example` is the correct pattern — it documents required vars without exposing real values.

---

## 3. Vitest Setup for React 18 + TypeScript + Zustand

### Confidence: MEDIUM (based on Vitest docs knowledge, version cross-referenced with package.json)

### Package versions to install

```bash
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

| Package | Purpose |
|---|---|
| `vitest` | Test runner, replaces Jest — native Vite integration |
| `@vitest/coverage-v8` | Coverage via V8 (faster than istanbul, no transpilation) |
| `jsdom` | DOM simulation for browser-like environment in Node |
| `@testing-library/react` | Render React components in tests |
| `@testing-library/user-event` | Simulate user interactions (better than fireEvent) |
| `@testing-library/jest-dom` | Custom matchers: `toBeInTheDocument`, `toHaveValue`, etc. |

Do NOT install `jest`, `babel-jest`, or `ts-jest` — Vitest handles TypeScript natively via Vite's esbuild pipeline.

### vitest.config.ts

Create at the project root (separate from `vite.config.ts` to keep concerns separated):

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/types/**',
        'src/lib/database.types.ts',
        'src/utils/seedData.ts',
        'src/main.tsx',
      ],
    },
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

Key decisions:
- `environment: 'jsdom'` — required for React component tests; pure util tests don't need it but it doesn't hurt
- `globals: true` — enables `describe`, `it`, `expect` without imports (matches Jest DX; requires adding `"types": ["vitest/globals"]` to `tsconfig.json`)
- `setupFiles` — runs before each test file, used for jest-dom matchers and global mocks
- `alias` — mirrors the `@/*` path alias in `tsconfig.json` so imports resolve correctly

### tsconfig.json additions

Add `"vitest/globals"` to the `compilerOptions.types` array so TypeScript recognizes the global test functions:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

### src/test/setup.ts

```typescript
import '@testing-library/jest-dom'
```

That single import registers all jest-dom matchers globally. Nothing else is needed in the setup file unless you add global mocks.

### package.json scripts to add

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

- `vitest` (watch mode) — for local development
- `vitest run` — for CI (single pass, exits with code)
- `--coverage` — generates coverage report to `coverage/`

---

## 4. Testing Zustand Stores

### Confidence: MEDIUM

### The core problem: stores persist across tests

Zustand stores are module-level singletons. If one test modifies store state, the next test inherits that state. This is the #1 cause of flaky Zustand tests.

### Pattern 1: Reset via `setState` in `beforeEach` (preferred for simple stores)

```typescript
import { useDealsStore } from '@/store/dealsStore'
import { act } from '@testing-library/react'

beforeEach(() => {
  act(() => {
    useDealsStore.setState({
      deals: [],
      filters: { search: '', stage: '', assignedTo: '', priority: '', valueMin: '', valueMax: '', dueDateFrom: '', dueDateTo: '' },
      selectedId: null,
      isLoading: false,
      viewMode: 'kanban',
    })
  })
})
```

This is the simplest approach. No need to re-create the store — Zustand's `setState` replaces the entire state object.

### Pattern 2: Zustand's `resetAllStores` utility

For projects with many stores, create a test utility:

```typescript
// src/test/resetStores.ts
import { useDealsStore } from '@/store/dealsStore'
import { useContactsStore } from '@/store/contactsStore'
// ... import all stores

export function resetAllStores() {
  useDealsStore.setState(useDealsStore.getInitialState?.() ?? {})
  useContactsStore.setState(useContactsStore.getInitialState?.() ?? {})
}
```

Call `beforeEach(resetAllStores)` in a global setup file or in each test file.

### The `persist` middleware complication

The `dealsStore` (and others) use `zustand/middleware`'s `persist`, which writes to `localStorage`. In jsdom, `localStorage` exists but persists across tests within the same worker process.

**Fix:** Clear localStorage in `beforeEach`:

```typescript
beforeEach(() => {
  localStorage.clear()
  // then reset store state
})
```

Or mock `localStorage` entirely in `setup.ts`:

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'

// Prevent Zustand persist from writing between tests
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })
```

### Mocking the Supabase client

The `src/lib/supabase.ts` already returns `null` when env vars are missing. In the test environment, `import.meta.env.VITE_SUPABASE_URL` will be `undefined`, so `isSupabaseConfigured` is `false` and `supabase` is `null`. This means:

- Pure store tests that don't call Supabase will work without any mocking
- If you add Supabase calls to stores later, mock the client explicitly:

```typescript
// src/test/mocks/supabase.ts
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
  isSupabaseConfigured: false,
}))
```

Use `vi.mock` (Vitest's equivalent of `jest.mock`) at the top of test files that need it.

### Example: Testing a Zustand store action

```typescript
// src/store/dealsStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDealsStore } from '@/store/dealsStore'
import { act } from '@testing-library/react'

beforeEach(() => {
  localStorage.clear()
  act(() => {
    useDealsStore.setState({ deals: [], selectedId: null, isLoading: false, viewMode: 'kanban' })
  })
})

describe('useDealsStore', () => {
  it('adds a deal and assigns an id', () => {
    act(() => {
      useDealsStore.getState().addDeal({
        title: 'Test Deal',
        value: 10000,
        stage: 'lead',
        contactId: 'c1',
        assignedTo: 'user1',
        priority: 'medium',
        linkedDeals: [],
        quoteItems: [],
      })
    })
    const { deals } = useDealsStore.getState()
    expect(deals).toHaveLength(1)
    expect(deals[0].id).toBeDefined()
    expect(deals[0].title).toBe('Test Deal')
  })

  it('filters deals by stage', () => {
    // ... setup state, call getFilteredDeals(), assert
  })
})
```

---

## 5. Testing Lead Scoring and Pure Utility Functions

### Confidence: HIGH (pure functions, no DOM or React needed)

The `src/utils/leadScoring.ts` file contains two pure functions (`computeLeadScore`, `calculateLeadScore`) with no side effects, no imports from React, and no Supabase calls. These are the highest-value, easiest tests in the codebase.

No jsdom needed — these tests run in `node` environment. You can even override the environment per-file:

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeLeadScore } from '@/utils/leadScoring'
import type { Contact, Activity, Deal } from '@/types'

const baseContact: Contact = {
  id: 'c1',
  name: 'Test Contact',
  email: 'test@example.com',
  status: 'lead',
  lastContactedAt: null,
  phone: '',
  jobTitle: '',
  notes: '',
  companyId: '',
  linkedDeals: [],
  // ... other required fields
}

describe('computeLeadScore', () => {
  it('returns score of 0 for a cold contact with no data', () => {
    const result = computeLeadScore(baseContact, [], [])
    expect(result.score).toBe(0)
    expect(result.label).toBe('Frío')
  })

  it('gives maximum activity recency score for contact contacted today', () => {
    const recentContact = {
      ...baseContact,
      lastContactedAt: new Date().toISOString(),
      status: 'customer' as const,
    }
    const result = computeLeadScore(recentContact, [], [])
    expect(result.breakdown.activityRecency).toBe(30)
    expect(result.breakdown.contactStatus).toBe(20)
  })

  it('caps total score at 100', () => {
    // Test with all max conditions
    const result = computeLeadScore({ ...baseContact, status: 'customer', lastContactedAt: new Date().toISOString(), phone: '555', jobTitle: 'CEO', notes: 'important', companyId: 'co1' }, Array(5).fill({ contactId: 'c1', type: 'email', status: 'completed' }), [{ contactId: 'c1', value: 100000, id: 'd1' }])
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
```

### Testing React Hook Form + Zod validation

The key insight: Zod schemas are pure TypeScript functions. Test the schema directly without React or forms:

```typescript
// src/components/deals/DealForm.test.ts (schema-level)
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Import or re-define the schema used in the form
const dealSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  value: z.number().min(0, 'Value must be non-negative'),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']),
})

describe('Deal form validation schema', () => {
  it('rejects empty title', () => {
    const result = dealSchema.safeParse({ title: '', value: 1000, stage: 'lead' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Title is required')
    }
  })

  it('accepts valid deal data', () => {
    const result = dealSchema.safeParse({ title: 'New Deal', value: 5000, stage: 'qualified' })
    expect(result.success).toBe(true)
  })
})
```

For testing the React Hook Form component itself (integration-level), use `@testing-library/react` + `@testing-library/user-event`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DealForm } from '@/components/deals/DealForm'

it('shows validation error when title is empty', async () => {
  const user = userEvent.setup()
  render(<DealForm onSubmit={vi.fn()} />)

  await user.click(screen.getByRole('button', { name: /save/i }))

  expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
})
```

**Recommendation:** Prioritize schema-level tests (fast, zero dependencies) over component-level form tests. Component tests are valuable for interaction flows but expensive to write and maintain. Use `@testing-library/user-event` v14+ (not `fireEvent`) for realistic user simulation.

---

## 6. CI/CD with GitHub Actions + Vercel

### Confidence: HIGH (Vercel docs verified)

### Default behavior (no GitHub Actions needed)

Vercel's native GitHub integration handles the core CD workflow automatically:
- Push to `main` → production deployment
- Push to any other branch → preview deployment
- PR created → preview URL posted as comment

For most projects, this is sufficient. You do NOT need GitHub Actions for deployments.

### When to add GitHub Actions

Add a GitHub Actions workflow to run tests BEFORE Vercel deploys. This prevents a broken build from reaching preview/production.

**Recommended workflow:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm run test:run

      - name: Coverage report
        run: npm run test:coverage
        if: github.event_name == 'pull_request'
```

**About Vercel + GitHub Actions interaction:**

Vercel deploys regardless of GitHub Actions status by default. To block Vercel from deploying until tests pass, use one of two approaches:

**Option A (simpler): Use Vercel's Ignored Build Step**

In Project Settings > Git > Ignored Build Step, add a script that fails if tests haven't passed. Vercel checks this before building.

**Option B (full control): Disable Vercel's GitHub integration and deploy via GitHub Actions**

```yaml
# .github/workflows/deploy.yml (replaces Vercel's native integration)
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:run
      - name: Deploy to Vercel
        run: |
          npm install -g vercel@latest
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

This requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` as GitHub repository secrets. Get them from `vercel link` + `cat .vercel/project.json`.

**Recommendation for CRM Pro:** Use Option A (native Vercel integration) + a separate CI workflow that runs `tsc --noEmit` and `vitest run`. This is lower friction and sufficient for a solo/small team project.

### Required GitHub secrets (if using Option B)

| Secret | How to get |
|---|---|
| `VERCEL_TOKEN` | vercel.com > Account Settings > Tokens |
| `VERCEL_ORG_ID` | `cat .vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | `cat .vercel/project.json` after `vercel link` |

---

## 7. Environment Management Summary

### Confidence: HIGH

### File hierarchy (Vite's load order, later overrides earlier)

```
.env                    # base defaults (committed, non-secret only)
.env.local              # local overrides (gitignored, highest priority locally)
.env.[mode]             # mode-specific (e.g., .env.production)
.env.[mode].local       # mode-specific local overrides (gitignored)
```

For this project, the practical setup is:

```
.env.example            # committed — documents required vars with placeholder values
.env.local              # gitignored — actual values for local development
```

Never create `.env.production` with real Supabase credentials — those belong in Vercel's dashboard, not in the repository.

### The two-Supabase-project pattern

Recommended for any production app:

| Environment | Supabase Project | Data | Purpose |
|---|---|---|---|
| Production | `crm-prod` | Real customer data | Live app |
| Preview/Staging | `crm-staging` | Seed/test data | Branch previews, QA |
| Local dev | `crm-staging` (same) or `localhost` | Seed data | Feature development |

Configure Vercel to use different VITE_SUPABASE_URL values per environment (Production vs Preview). This prevents preview deployments from touching production data.

For local Supabase (via `supabase start` CLI): the local URL is always `http://127.0.0.1:54321` and the anon key is a well-known test value. Use these in `.env.local` when developing offline.

### Vitest environment variables

Vitest does NOT load `.env` files by default. For tests that need env vars:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
```

Or use a `.env.test` file and configure `envFile` in Vitest config. For this project, since the Supabase client gracefully returns `null` when vars are absent, you can skip this for most tests. Only add env vars if you need `isSupabaseConfigured` to be `true` in a specific test.

---

## Implementation Order

Based on all findings, the recommended implementation sequence:

1. **Add `vercel.json`** at repo root (SPA rewrite rule) — 5 minutes, blocks production routing
2. **Connect repo to Vercel** via dashboard, set env vars for Production and Preview environments
3. **Install Vitest + testing deps** (`npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`)
4. **Create `vitest.config.ts`** and `src/test/setup.ts` with localStorage mock
5. **Add test scripts** to `package.json`
6. **Write first tests** — `leadScoring.ts` pure functions (no setup needed, immediate value)
7. **Write store tests** — `dealsStore`, `contactsStore` with beforeEach state reset
8. **Add `.github/workflows/ci.yml`** — type check + test run on PR
9. **Configure two Supabase projects** (prod + staging) and assign to Vercel environments

---

## Packages to Add

```bash
# Testing (all dev dependencies)
npm install -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom

# Optional: Vitest UI (visual test runner in browser)
npm install -D @vitest/ui
```

No production dependencies are needed for deployment — `vercel.json` is the only new file.

---

## Known Gaps / Needs Validation

- **Vite 8 compatibility with Vitest:** Vite 8 was released in 2025. Vitest v3+ supports Vite 5+; the Vite 8 / Vitest compatibility should be confirmed at `vitest.dev` before finalizing. If issues arise, pin `vitest` to a specific version that explicitly lists Vite 8 peer support. MEDIUM confidence on this pairing.
- **Zustand v5 `getInitialState` API:** Zustand v5 (used in this project per `package.json`) introduced store snapshots. The `getInitialState()` method availability should be confirmed against Zustand v5 changelog. If absent, the manual `setState({})` reset pattern is the safe fallback.
- **`@hookform/resolvers` v5 + Zod v4:** The project uses both at their latest major versions. Any breaking changes in resolver API since Zod v4 release should be checked if form-level component tests fail unexpectedly.

---

## Sources

- Vercel Vite deployment docs: https://vercel.com/docs/frameworks/vite (HIGH confidence, fetched 2026-03-31)
- Vercel environment variables: https://vercel.com/docs/environment-variables (HIGH confidence, fetched 2026-03-31)
- Vercel environments: https://vercel.com/docs/deployments/environments (HIGH confidence, fetched 2026-03-31)
- Vercel GitHub integration: https://vercel.com/docs/git/vercel-for-github (HIGH confidence, fetched 2026-03-31)
- Vercel custom domains: https://vercel.com/docs/domains/working-with-domains/add-a-domain (HIGH confidence, fetched 2026-03-31)
- Vitest docs: https://vitest.dev — inaccessible during research session; findings based on training knowledge (MEDIUM confidence, knowledge cutoff August 2025)
- Supabase env vars: Training knowledge confirmed against project's existing `src/lib/supabase.ts` and `.env.example` (MEDIUM confidence)
- Project source: `src/lib/supabase.ts`, `src/store/dealsStore.ts`, `src/utils/leadScoring.ts`, `package.json`, `tsconfig.json`
