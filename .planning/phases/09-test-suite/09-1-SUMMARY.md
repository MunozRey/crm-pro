---
phase: 09-test-suite
plan: 1
title: "Configure Vitest + Coverage"
one-liner: "Added @/* path alias and v8 coverage config to vite.config.ts; all 19 existing tests pass with coverage reporting enabled."
completed: 2026-04-09
duration: 10m
tasks-completed: 3
files-modified: 2
key-decisions:
  - "@vitest/coverage-v8 was already installed at ^4.1.4; Task 1 skipped"
  - "Kept existing test:watch script, added test:run and test:coverage alongside it"
requirements: [TEST-01]
---

# Phase 09 Plan 1: Configure Vitest + Coverage Summary

## What Was Done

Configured the Vitest test infrastructure with two missing pieces:

1. **`resolve.alias`** added at the top level of `defineConfig` in `vite.config.ts`, mapping `@` to `./src`. This allows any test file to use `@/` imports without "Cannot find module" errors.

2. **`coverage` block** added inside the `test` section, using the `v8` provider with `text` and `lcov` reporters. Coverage scope is limited to `src/store/**`, `src/utils/**`, and `src/lib/schemas/**`, excluding `src/utils/seedData.ts`.

3. **npm scripts** updated in `package.json`:
   - `test` changed from `vitest run` to `vitest` (watch mode)
   - `test:run` added (`vitest run`)
   - `test:coverage` added (`vitest run --coverage`)
   - `test:watch` retained as-is

## Verification Results

- `npx vitest run`: **19 passed, 0 failed**
- `npx vitest run --coverage`: coverage report generated with v8 provider, no errors

## Deviations from Plan

**1. [Rule 1 - Skip] @vitest/coverage-v8 already installed**
- Found during: Task 1
- Issue: `package.json` already had `"@vitest/coverage-v8": "^4.1.4"` in devDependencies
- Fix: Skipped the npm install step
- No files affected

## Known Stubs

None.

## Self-Check: PASSED

- `vite.config.ts` contains `resolve.alias` and `test.coverage` blocks: confirmed
- `package.json` contains `test`, `test:run`, `test:coverage` scripts: confirmed
- Commit `0483639c` exists: confirmed
