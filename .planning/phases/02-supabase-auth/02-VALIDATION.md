---
phase: 2
slug: supabase-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract. Phase 2 introduces auth wiring and is the first phase with automated unit tests (Vitest + RTL).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (not yet installed — Wave 0 installs it) |
| **Config file** | `vite.config.ts` — add `test` block, or `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** `npx vitest run --reporter=verbose` (once Wave 0 installs Vitest)
- **After every plan wave:** Full suite `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2.0-vitest-setup | W0 | 0 | TEST-01 | infra | `npx vitest run` exits 0 | ❌ W0 | ⬜ pending |
| 2.1-signup | 2.1 | 1 | AUTH-01 | unit | `npx vitest run tests/auth/Register.test.tsx` | ❌ W0 | ⬜ pending |
| 2.1-verify-email | 2.1 | 1 | AUTH-02 | unit | `npx vitest run tests/auth/Register.test.tsx` | ❌ W0 | ⬜ pending |
| 2.2-login | 2.2 | 1 | AUTH-01 | unit | `npx vitest run tests/auth/Login.test.tsx` | ❌ W0 | ⬜ pending |
| 2.2-oas | 2.2 | 1 | AUTH-04 | unit | `npx vitest run tests/auth/authStore.test.ts` | ❌ W0 | ⬜ pending |
| 2.3-forgot-pw | 2.3 | 2 | AUTH-03 | unit | `npx vitest run tests/auth/ForgotPassword.test.tsx` | ❌ W0 | ⬜ pending |
| 2.3-reset-pw | 2.3 | 2 | AUTH-03 | unit | `npx vitest run tests/auth/ResetPassword.test.tsx` | ❌ W0 | ⬜ pending |
| 2.4-loading-guard | 2.4 | 2 | AUTH-04 | unit | `npx vitest run tests/auth/ProtectedRoute.test.tsx` | ❌ W0 | ⬜ pending |
| 2.5-logout | 2.5 | 2 | AUTH-05 | unit | `npx vitest run tests/auth/authStore.test.ts` | ❌ W0 | ⬜ pending |
| 2.x-sec01 | 2.2 | 1 | SEC-01 | manual | Code inspection — simpleHash not called | N/A | ⬜ pending |
| 2.x-sec06 | 2.1 | 1 | SEC-06 | unit | `npx vitest run tests/lib/supabase.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `"test": "vitest run"` script and install `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- [ ] `vite.config.ts` — add `test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] }` block
- [ ] `tests/setup.ts` — `@testing-library/jest-dom` import + Supabase mock setup
- [ ] `tests/auth/authStore.test.ts` — stubs for AUTH-01, AUTH-04, AUTH-05
- [ ] `tests/auth/Register.test.tsx` — stubs for AUTH-01, AUTH-02
- [ ] `tests/auth/Login.test.tsx` — stubs for AUTH-01
- [ ] `tests/auth/ForgotPassword.test.tsx` — stubs for AUTH-03
- [ ] `tests/auth/ResetPassword.test.tsx` — stubs for AUTH-03
- [ ] `tests/auth/ProtectedRoute.test.tsx` — stubs for AUTH-04
- [ ] `tests/lib/supabase.test.ts` — stubs for SEC-06

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email delivered to inbox | AUTH-02 | Requires live Supabase + real email | Register with real email; check inbox for verification link |
| Password reset email works | AUTH-03 | Requires live Supabase + email delivery | Submit ForgotPassword form; click link in email; verify new password works |
| Session survives hard refresh | AUTH-04 | Requires real browser | Log in, press Ctrl+Shift+R; confirm dashboard loads without /login flash |
| Back button blocked after logout | AUTH-05 | Requires real browser | Log in, log out, press Back; confirm /login shown not dashboard |

---

## Validation Sign-Off

- [ ] Wave 0 installs Vitest and creates all stub test files
- [ ] All automated tests pass: `npx vitest run` exits 0
- [ ] Manual browser tests verified against live Supabase project
- [ ] `simpleHash` code path confirmed unreachable when Supabase is configured
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
