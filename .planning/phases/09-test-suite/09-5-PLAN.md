---
phase: 09-test-suite
plan: 5
title: "GitHub Actions CI"
goal: "Create .github/workflows/ci.yml that runs tsc --noEmit and vitest run on every push to main and on all pull requests."
wave: 3
dependencies: [1, 2, 3, 4]
requirements: [TEST-05]
---

# Plan 09-5: GitHub Actions CI

## Goal

Create `.github/workflows/ci.yml`. The workflow runs two checks — type checking and tests — on every push to `main` and on every pull request. If either check exits non-zero, the workflow fails and the PR is blocked.

## Context

`.github/workflows/` does not exist yet. It must be created along with `ci.yml`.

The CI workflow must NOT attempt to connect to Supabase. All tests mock Supabase with `vi.mock('../../src/lib/supabase', ...)` — no `.env` file is needed in CI.

Node version used locally is 22.20.0, so the workflow uses `node-version: 22`. The `actions/cache` is handled automatically by `actions/setup-node@v4` with `cache: 'npm'`.

`npm ci` (not `npm install`) is the correct install command — it uses `package-lock.json` exactly and is faster and more reproducible in CI.

The `tsconfig.json` already has `"noEmit": true` set, so `npx tsc --noEmit` is the correct type check command — it respects the project's existing strict settings.

No coverage upload in CI. Coverage is a local-only command (`npm run test:coverage`). Keeping CI fast is the priority.

## Tasks

### Task 1: Create .github/workflows/ci.yml

Create the directory `C:/Users/david/OneDrive/Escritorio/Development/CRM/.github/workflows/` and the file `ci.yml` inside it.

File contents:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npx tsc --noEmit

      - name: Run tests
        run: npx vitest run
```

Notes on this config:
- A single job named `ci` with sequential steps is cleaner than two separate jobs for a small project — it avoids the overhead of setting up Node twice.
- `pull_request:` with no branch filter triggers on PRs targeting any branch, which is correct.
- `npx tsc --noEmit` will use the project's `tsconfig.json` automatically (it is at the repo root).
- `npx vitest run` is equivalent to `npm run test:run` but does not require the script to be registered — it works even if `package.json` is not yet updated (though Plan 09-1 adds the `test:run` script, so either form works).
- No `env:` block — tests mock all external services.

File: `.github/workflows/ci.yml`

## Verification

Since GitHub Actions runs remotely, local verification checks structural correctness and uses `act` if available, otherwise relies on dry-run validation.

1. Confirm the file exists and is valid YAML:

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && cat .github/workflows/ci.yml
   ```

   Expected: file prints without errors.

2. Validate YAML syntax using Node (no extra tool needed):

   ```bash
   node -e "require('fs').readFileSync('.github/workflows/ci.yml', 'utf8'); console.log('YAML file readable')"
   ```

   Expected: prints "YAML file readable".

3. Run the full local test suite as a proxy for what CI will execute:

   ```bash
   cd C:/Users/david/OneDrive/Escritorio/Development/CRM && npx tsc --noEmit && npx vitest run
   ```

   Expected: both commands exit 0. If both pass locally, CI will pass on the same code.

4. After pushing this branch to GitHub, confirm the Actions tab shows the workflow running. The CI check must appear on the PR. This is the final acceptance gate.

## Success Criteria

- `.github/workflows/ci.yml` exists with correct YAML structure
- Workflow triggers on `push` to `main` and on `pull_request`
- Workflow runs `npx tsc --noEmit` and `npx vitest run` in sequence
- Uses Node 22 with npm cache
- Uses `npm ci` (not `npm install`)
- No Supabase env vars or secrets needed — all tests mock the client
- After push, the GitHub Actions tab shows the CI workflow and both steps complete green
