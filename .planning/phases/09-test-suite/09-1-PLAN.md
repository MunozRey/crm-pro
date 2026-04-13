---
phase: 09-test-suite
plan: 1
title: "Configure Vitest + Coverage"
goal: "Install @vitest/coverage-v8, add path alias and coverage config to vite.config.ts, and add npm test scripts — all 19 existing tests continue to pass."
wave: 1
dependencies: []
requirements: [TEST-01]
---

# Plan 09-1: Configure Vitest + Coverage

## Goal

Install `@vitest/coverage-v8`, wire the path alias `@/*` into `vite.config.ts`, add coverage config, and register `test`, `test:run`, and `test:coverage` npm scripts. The 19 existing tests must still pass after the changes.

## Context

`vite.config.ts` already has a `test` block with `environment: 'jsdom'`, `globals: true`, and `setupFiles`. Two things are missing:

1. The top-level `resolve.alias` block for `@/*` — without it, any new test file that uses `@/` imports fails with "Cannot find module '@/...'".
2. A `coverage` sub-block inside `test` — required for `vitest run --coverage` to produce reports.

`@vitest/coverage-v8` is not installed (`package.json` has no entry). Vitest version is 4.1.2; install `@vitest/coverage-v8@^4.1.4` to stay in range.

The existing `tests/__mocks__/supabase.ts` file is dead code (Vitest does not auto-load it). Do not delete it — just leave it in place.

## Tasks

### Task 1: Install @vitest/coverage-v8

Run from the project root (`C:/Users/david/OneDrive/Escritorio/Development/CRM`):

```bash
npm install -D @vitest/coverage-v8
```

This adds `@vitest/coverage-v8` to `devDependencies` in `package.json` and `package-lock.json`. No other changes in this step.

### Task 2: Update vite.config.ts

Replace the contents of `vite.config.ts` with the following. The key additions are:
- `import { resolve } from 'path'` at the top
- Top-level `resolve.alias` pointing `@` to `./src` (applies to both Vite builds and Vitest)
- `coverage` block inside `test`

```typescript
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

File: `vite.config.ts` (project root)

### Task 3: Add npm test scripts

Open `package.json` and add three entries to the `"scripts"` section. Do not remove or rename existing scripts — only add the three new ones.

```json
"test": "vitest",
"test:run": "vitest run",
"test:coverage": "vitest run --coverage"
```

After adding, the scripts object must contain at least these three keys. Other existing scripts (e.g., `dev`, `build`, `lint`) are untouched.

File: `package.json` (project root)

## Verification

1. Run the full test suite to confirm all 19 existing tests still pass:

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run
   ```

   Expected: `19 passed`, 0 failed, exit code 0.

2. Confirm coverage command resolves without "provider not found" error:

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run --coverage --reporter=verbose 2>&1 | head -20
   ```

   Expected: coverage output begins printing (even if no test files match `src/store/**` yet — that is fine at this stage).

3. Verify `@` alias resolves in vitest by creating a one-line smoke test file, running it, then deleting it:

   ```bash
   echo "import { describe, it } from 'vitest'; describe('alias', () => { it('resolves', () => {}) })" > C:/Users/david/OneDrive/Escritorio/Development/CRM/tests/alias-smoke.test.ts
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx vitest run tests/alias-smoke.test.ts
   rm C:/Users/david/OneDrive/Escritorio/Development/CRM/tests/alias-smoke.test.ts
   ```

   Expected: 1 test passes, no "Cannot find module" error.

## Success Criteria

- `npm run test:run` exits 0 with 19 tests passing
- `npm run test:coverage` runs without "Cannot find provider" or "Cannot find module" errors
- `vite.config.ts` contains a top-level `resolve.alias` block and a `test.coverage` block
- `package.json` contains `test`, `test:run`, and `test:coverage` scripts
