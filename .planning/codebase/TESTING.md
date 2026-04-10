# Testing Patterns

**Analysis Date:** 2026-04-10

## Test Framework

**Runner:** Vitest 4 (`vitest`)

**Environment:** jsdom

**Libraries:**
- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `@vitest/coverage-v8`

**Commands:**
- `npm run test` (watch)
- `npm run test:run` (CI/local full run)
- `npm run test:coverage`

## Current Baseline

- Test files: 15
- Total tests: 105 passing
- CI includes test + typecheck (`vitest run` + `tsc --noEmit`)
- Build remains part of release validation (`npm run build`)

## Test File Organization

- Main tests are under `tests/**` grouped by domain:
  - `tests/auth/*`
  - `tests/stores/*`
  - `tests/utils/*`
  - `tests/schemas/*`
- Shared setup: `tests/setup.ts`
- Vitest configuration is embedded in `vite.config.ts` (`test` key).

## Patterns In Use

**Store tests (Zustand + Supabase-aware):**
- Mock Supabase client interactions per file with `vi.mock(...)`.
- Reset state between tests.
- Verify add/update/delete and selector behavior.

**Schema tests (Zod):**
- Validate required fields and coercion behavior.
- Assert invalid payloads fail with expected field-level messages.

**Auth/i18n page tests:**
- Use language-tolerant matchers where copy can vary by locale.
- Assert flows (login/register/recovery/reset) instead of exact UI cosmetics.

## Remaining Testing Gaps

- Gmail end-to-end flows (OAuth callback + token refresh + attachment download) are still primarily manual smoke/UAT.
- Edge Functions are validated through integration/manual checks rather than local isolated unit suites.
- Route-level lazy loading behavior is validated via build artifacts/manual smoke, not dedicated automated assertions.

## Quality Gates

- Required before merge/release:
  - `npm run test:run`
  - `npm run build`
- For changes to schemas/stores/auth flows:
  - Add/adjust targeted tests in `tests/**`.

---

*Testing analysis: 2026-04-10*
