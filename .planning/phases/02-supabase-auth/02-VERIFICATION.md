---
phase: 02-supabase-auth
verified: 2026-04-05T16:00:00Z
status: human_needed
score: 10/10 must-haves verified
human_verification:
  - test: "Register with a real email and Supabase configured. Verify email confirmation email is received."
    expected: "User receives Supabase-generated email with confirmation link; clicking link activates account."
    why_human: "Requires real SMTP delivery and a live Supabase project — cannot verify programmatically."
  - test: "Log in with valid credentials, close the browser tab, reopen the app, and navigate directly to a protected page."
    expected: "User lands on the protected page without being redirected to /login (session persisted via Supabase SDK localStorage key)."
    why_human: "Session persistence across a real browser reload requires a live Supabase project with a real access token."
  - test: "Use the ForgotPassword form with a real email address. Verify the password-reset email is received."
    expected: "User receives an email with a reset link that redirects to /reset-password?type=recovery&..."
    why_human: "Requires real Supabase SMTP delivery."
  - test: "Follow the password-reset email link, set a new password in ResetPassword, then log in with the new password."
    expected: "User is redirected to / after updating password; old password no longer works."
    why_human: "Requires the full Supabase password-recovery token flow in a real browser session."
  - test: "Log in, click logout, then press the browser Back button."
    expected: "Back button does not restore the session — user remains on /login."
    why_human: "Requires verifying that supabase.auth.signOut() clears the SDK's own localStorage token, which can only be confirmed in a real browser with a real Supabase session."
---

# Phase 2: Supabase Auth Verification Report

**Phase Goal:** Users can register, log in, reset their password, and have their session persist across page refreshes — replacing the mock djb2 system entirely.
**Verified:** 2026-04-05
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | authStore uses supabase.auth.signUp() for register (not simpleHash) | VERIFIED | Register.tsx:32 — `supabase.auth.signUp()` inside `isSupabaseConfigured` guard |
| 2 | authStore uses supabase.auth.signInWithPassword() for login | VERIFIED | Login.tsx:24 — `supabase.auth.signInWithPassword()` inside `isSupabaseConfigured` guard |
| 3 | onAuthStateChange listener replaces getSession() pattern | VERIFIED | authStore.ts:432 — single `onAuthStateChange` call; no `getSession()` call anywhere in initSupabaseAuth |
| 4 | isLoadingAuth defaults to true (not false) | VERIFIED | authStore.ts:140 — `isLoadingAuth: true` in initial state |
| 5 | ProtectedRoute returns null while isLoadingAuth is true | VERIFIED | ProtectedRoute.tsx:19-21 — `if (isLoadingAuth) return null` is the first guard |
| 6 | supabase.auth.signOut() called in logout | VERIFIED | authStore.ts:192 — `await supabase.auth.signOut()` inside `isSupabaseConfigured` guard |
| 7 | ForgotPassword page exists at src/pages/ForgotPassword.tsx | VERIFIED | File exists; calls `resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })` |
| 8 | ResetPassword page exists at src/pages/ResetPassword.tsx | VERIFIED | File exists; calls `supabase.auth.updateUser({ password })` and navigates to `/` on success |
| 9 | Routes for /forgot-password and /reset-password in App.tsx | VERIFIED | App.tsx:55-56 — both routes registered as public (no ProtectedRoute wrapper) |
| 10 | console.warn when Supabase env vars absent in src/lib/supabase.ts | VERIFIED | supabase.ts:11-16 — `!isSupabaseConfigured && import.meta.env.DEV` guard with `[CRM]` prefix |

**Score:** 10/10 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/supabase.ts` | Supabase client factory + SEC-06 warning | VERIFIED | isSupabaseConfigured check; console.warn with [CRM] prefix; client is null when unconfigured |
| `src/store/authStore.ts` | initSupabaseAuth with onAuthStateChange; logout with signOut; isLoadingAuth: true | VERIFIED | All three present and substantive |
| `src/pages/Register.tsx` | Calls supabase.auth.signUp() with dual-path (session vs. no-session) | VERIFIED | Dual-path: session → navigate('/'), no session → setSuccess(true) |
| `src/pages/Login.tsx` | Calls supabase.auth.signInWithPassword(); link to /forgot-password | VERIFIED | Both present at lines 24 and 116 |
| `src/pages/ForgotPassword.tsx` | Calls resetPasswordForEmail with redirectTo; success state UI | VERIFIED | 114-line substantive implementation |
| `src/pages/ResetPassword.tsx` | Calls updateUser({ password }); validates match; navigates to / | VERIFIED | Password match validation + updateUser call present |
| `src/components/auth/ProtectedRoute.tsx` | Returns null while loading; Navigate to /login when unauthenticated | VERIFIED | isLoadingAuth guard before isAuthenticated check |
| `src/App.tsx` | Imports + routes ForgotPassword/ResetPassword; useEffect wires initSupabaseAuth cleanup | VERIFIED | Lines 24-25 (imports), 55-56 (routes), 89-92 (cleanup useEffect) |
| `tests/auth/authStore.test.ts` | Real AUTH-04 + AUTH-05 tests (not stubs) | VERIFIED | 4 tests: INITIAL_SESSION resolves loading, AuthUser shape, SIGNED_OUT clears, logout calls signOut |
| `tests/auth/ProtectedRoute.test.tsx` | Real AUTH-04 tests for loading/redirect/render states | VERIFIED | 3 tests covering all three ProtectedRoute states |
| `tests/lib/supabase.test.ts` | Real SEC-06 tests using vi.stubEnv + vi.resetModules | VERIFIED | 2 tests: warn fires when unconfigured, no warn when configured |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Register.tsx | supabase.auth.signUp() | isSupabaseConfigured guard | WIRED | Line 32; response handled (data.session branch + error branch) |
| Login.tsx | supabase.auth.signInWithPassword() | isSupabaseConfigured guard | WIRED | Line 24; error branch + navigate('/') on success |
| ForgotPassword.tsx | supabase.auth.resetPasswordForEmail() | isSupabaseConfigured guard | WIRED | Line 20; error branch + setSuccess(true) on success |
| ResetPassword.tsx | supabase.auth.updateUser() | isSupabaseConfigured guard | WIRED | Line 29; error branch + navigate('/') on success |
| authStore.ts logout() | supabase.auth.signOut() | isSupabaseConfigured guard | WIRED | Line 192; awaited; clears 4 state fields after |
| App.tsx | initSupabaseAuth() | useEffect cleanup | WIRED | Line 90; cleanup function returned and used |
| initSupabaseAuth | onAuthStateChange | single listener pattern | WIRED | Line 432; no getSession() pre-call |
| onAuthStateChange callback | setIsLoadingAuth(false) | first line in callback | WIRED | Line 434; fires on every event including INITIAL_SESSION |
| ProtectedRoute | isLoadingAuth | useAuthStore selector | WIRED | Line 12; checked before isAuthenticated on line 19 |
| Login.tsx | /forgot-password | Link component | WIRED | Line 116; displayed in both Supabase and mock mode |
| App.tsx | /forgot-password route | public Route | WIRED | Line 55 |
| App.tsx | /reset-password route | public Route | WIRED | Line 56 |

---

## Data-Flow Trace (Level 4)

Not applicable for auth pages — these components receive no async data from a DB. Auth state is set by Supabase callbacks and Zustand, not by component-level fetches. Session data flows from Supabase SDK → onAuthStateChange → Zustand → component selectors.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite (19 tests) | `npm test` | 7 files, 19 tests passed, exit 0 | PASS |
| ForgotPassword page exists | file check | 114-line substantive component | PASS |
| ResetPassword page exists | file check | 116-line substantive component | PASS |
| isLoadingAuth initial value | grep authStore.ts | `isLoadingAuth: true` at line 140 | PASS |
| ProtectedRoute loading guard | grep ProtectedRoute.tsx | `if (isLoadingAuth) return null` at line 19 | PASS |
| supabaseSession excluded from partialize | grep authStore.ts | Excluded with explanatory comment at line 411 | PASS |
| No getSession() in initSupabaseAuth | grep authStore.ts | Absent — only onAuthStateChange present | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 02.1 | User can sign up with email and password via Supabase Auth | SATISFIED | Register.tsx calls supabase.auth.signUp(); Login.tsx calls signInWithPassword() |
| AUTH-02 | 02.1 | User receives email verification after signup | SATISFIED (code path) | Register.tsx: no-session branch shows "Check your email" screen; actual delivery requires human test |
| AUTH-03 | 02.3 | User can reset password via email link | SATISFIED (code path) | ForgotPassword.tsx + ResetPassword.tsx + routes wired; actual delivery requires human test |
| AUTH-04 | 02.4 | Session persists across browser refresh via onAuthStateChange + isLoadingAuth: true | SATISFIED | isLoadingAuth: true confirmed; onAuthStateChange is sole listener; ProtectedRoute returns null while loading |
| AUTH-05 | 02.5 | User can log out and session is fully cleared | SATISFIED | logout() calls signOut() + clears 4 store fields; test verifies it |
| SEC-01 | 02.5 | authStore weak djb2 hash replaced by Supabase Auth — passwords never stored locally | PARTIAL | Supabase code path never calls simpleHash. Mock/demo mode fallback retains simpleHash + persists passwords to localStorage (by deliberate design — passwords field included in partialize at line 415). Passwords are never stored when Supabase is configured. |
| SEC-06 | 02.1 | Dev-mode console.warn when Supabase env vars absent | SATISFIED | supabase.ts lines 11-16; test verifies the [CRM] prefix warning fires |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/store/authStore.ts` | 7-16 | `simpleHash` function retained; `passwords` field included in `partialize` (line 415) | Info | By design: mock/demo mode only. simpleHash never executes when Supabase is configured. SEC-01 is intentionally partial for this phase per 02.5-PLAN.md line 281. Not a blocker for the phase goal. |
| `src/store/authStore.ts` | 429 | Comment "isLoadingAuth is already true (initialized as false currently, fixed in plan 2.4)" is stale after plan 2.4 changed the default | Info | Stale comment causes confusion but does not affect runtime behavior. |
| `tests/auth/Register.test.tsx` | multiple | React `act(...)` warnings in test output | Info | Tests pass. Act warnings are cosmetic — caused by async state updates in Register.tsx after `userEvent.type`. No behavioral impact. |

---

## Human Verification Required

### 1. Email Delivery on Registration

**Test:** Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local with a real Supabase project. Open /register, fill in name, email, org name, and password. Submit the form.
**Expected:** The "Check your email" confirmation screen appears. The provided email address receives a Supabase confirmation email within ~1 minute.
**Why human:** SMTP delivery requires a live Supabase project and a real email address — cannot be verified programmatically.

### 2. Session Persistence Across Page Refresh

**Test:** With Supabase configured, log in successfully. Press F5 (hard refresh). Navigate directly to /contacts.
**Expected:** The user lands on /contacts without being redirected to /login. The Supabase SDK rehydrates the session via the `sb-<ref>-auth-token` localStorage key on the INITIAL_SESSION event.
**Why human:** Requires a live Supabase access token and real browser refresh cycle.

### 3. Password Reset Email Flow

**Test:** Go to /forgot-password, enter a registered email, submit. Check inbox.
**Expected:** A Supabase password-reset email arrives with a link containing `?type=recovery`. Clicking the link redirects to /reset-password (via PASSWORD_RECOVERY event in onAuthStateChange → window.location.replace). Enter a new password and save.
**Why human:** Requires live SMTP delivery and a complete browser session with the Supabase recovery token.

### 4. Logout + Back Button Session Clearing

**Test:** Log in with Supabase configured. Click logout. Press the browser Back button.
**Expected:** Back button returns to the page visually but the user is immediately redirected to /login because supabase.auth.signOut() cleared the SDK's localStorage token, so INITIAL_SESSION fires with null.
**Why human:** Requires verifying the Supabase SDK's own localStorage key (`sb-<ref>-auth-token`) is cleared — this cannot be inspected without a live session.

### 5. SEC-01 Completeness Assessment (Design Question)

**Test:** Decide whether mock/demo mode simpleHash retention is acceptable for the project.
**Expected:** If the demo mode will be removed before production, SEC-01 is satisfactorily partial. If demo mode will persist, passwords in localStorage for demo users may need to be documented or removed from partialize.
**Why human:** This is an architectural decision about whether the mock mode is temporary scaffolding or a permanent feature, which cannot be resolved by code inspection alone.

---

## Gaps Summary

No automated gaps were found. All 10 must-haves are verified in the codebase. The full test suite (19 tests across 7 files) passes with exit 0.

The only programmatic concern is SEC-01 partial status: `simpleHash` and the `passwords` field remain active for mock/demo mode, including `passwords` in `partialize` (localStorage persistence). This was explicitly scoped by 02.5-PLAN.md as "SEC-01 partial: simpleHash is not called in the Supabase code path." No gap is raised — it is by design.

Five items require human verification: email delivery for registration and password reset, session persistence in a real browser, logout session clearing, and a design review of the SEC-01 mock-mode retention.

---

_Verified: 2026-04-05T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
