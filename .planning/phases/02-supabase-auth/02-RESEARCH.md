> [!NOTE]
> Historical snapshot: this phase file is kept for audit/history and may be outdated.
> Source of truth for current status and priorities: `.planning/STATE.md` and `.planning/ROADMAP.md`.

> [!NOTE]
> Historical snapshot: this phase document is preserved for implementation history.
> Source of truth for current status and priorities:  and .

> **Historical Snapshot:** This phase document is retained for historical context. Current source of truth is `.planning/STATE.md` and `.planning/ROADMAP.md`.

# Phase 02: Supabase Auth — Research

**Researched:** 2026-03-31
**Domain:** Supabase Auth JS SDK v2, React 18, Zustand v5, React Router v6
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password via Supabase Auth | `supabase.auth.signUp()` — already partially wired in Register.tsx; needs email-verification state branch |
| AUTH-02 | User receives email verification after signup | Supabase sends verification automatically; UI must show "check your email" state and gate login until confirmed |
| AUTH-03 | User can reset password via email link | `supabase.auth.resetPasswordForEmail()` + `PASSWORD_RECOVERY` event handling in `onAuthStateChange` |
| AUTH-04 | User session persists across browser refresh | `onAuthStateChange` + `isLoadingAuth: true` initial state prevents race-condition redirect; `getSession()` seeds initial state |
| AUTH-05 | User can log out; session is fully cleared | `supabase.auth.signOut()` + clearing Zustand persist state + redirect to `/login` |
| SEC-01 | `authStore` weak djb2 hash replaced by Supabase Auth | Remove `simpleHash`, `passwords` record, mock `login()`, and mock `register()` from authStore |
| SEC-06 | Dev-mode console warning when Supabase env vars are absent | `isSupabaseConfigured` check exists but silent; add `console.warn` in dev mode when env vars missing |
</phase_requirements>

---

## Summary

Phase 2 replaces the mock djb2 authentication system in `authStore.ts` with real Supabase Auth. The bulk of the Supabase Auth plumbing is **already scaffolded** — `supabase.auth.signInWithPassword()` is live in Login.tsx, `supabase.auth.signUp()` is live in Register.tsx, and `initSupabaseAuth()` with `onAuthStateChange` exists in authStore.ts. What is missing: (1) a ForgotPassword page and the PASSWORD_RECOVERY event handler, (2) the `isLoadingAuth: true` initial-state race-condition guard in ProtectedRoute, (3) proper cleanup of the mock system (passwords record, SEED_USERS, simpleHash), and (4) the SEC-06 dev console warning.

The project's dual-mode architecture — falling through to mock auth when `isSupabaseConfigured` is false — should be preserved during this phase because other stores still depend on the mock users. The mock system gets fully removed when data stores are migrated in Phase 5.

**Primary recommendation:** Wire the four missing pieces (forgot-password page, PASSWORD_RECOVERY event, isLoadingAuth guard in ProtectedRoute, dev warning) and stop there. Do not remove SEED_USERS or mock store methods in this phase — that is Phase 5 scope.

---

## Current Codebase State (Critical Context)

Understanding what already exists prevents duplicate work and contradictions.

### Already Done

| Item | File | State |
|------|------|-------|
| `supabase.auth.signInWithPassword()` | `Login.tsx:24` | Wired, branched on `isSupabaseConfigured` |
| `supabase.auth.signUp()` | `Register.tsx:32` | Wired, shows "check your email" success screen |
| `initSupabaseAuth()` with `getSession()` + `onAuthStateChange` | `authStore.ts:409–448` | Wired, called in `App.tsx:85` |
| `supabase` client creation with `isSupabaseConfigured` guard | `lib/supabase.ts` | Complete |
| `setIsLoadingAuth` action | `authStore.ts:153` | Exists but `isLoadingAuth` initializes as `false` (bug) |
| `supabase.auth.signOut()` | Not present | Missing — logout() only clears Zustand state |

### Missing / Incomplete

| Gap | Impact | Plan |
|-----|--------|------|
| ForgotPassword page | AUTH-03 blocked | New page: 2.3 |
| `PASSWORD_RECOVERY` event in `onAuthStateChange` | AUTH-03 blocked | Update initSupabaseAuth: 2.3 |
| `isLoadingAuth` initializes as `false` | Race condition: ProtectedRoute redirects to /login before auth resolves | Fix authStore default: 2.4 |
| ProtectedRoute does not check `isLoadingAuth` | Race condition not guarded even if flag fixed | Update ProtectedRoute: 2.4 |
| `supabase.auth.signOut()` not called on logout | Session cookie remains after "logout" | Fix logout(): 2.5 |
| Zustand persist includes `supabaseSession` | Stale session token survives after signOut | partialize must exclude or clear it |
| SEC-06 silent on missing env vars | Developer unaware app running in mock mode | Add console.warn: 2.1 |
| `passwords` and `simpleHash` still in store | SEC-01 — passwords stored locally | Defer full removal to Phase 5, but mark clearly |
| Route `/forgot-password` does not exist | No navigation to reset flow | New route: 2.3 |
| No "forgot password" link on Login.tsx | User cannot reach reset flow | Add link: 2.3 |

---

## Standard Stack

### Core

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `@supabase/supabase-js` | 2.100.1 (latest: 2.101.0) | Auth SDK, session management | Already installed; official Supabase SDK |
| `zustand` | 5.0.12 | Auth state store | Already installed; used throughout |
| `react-router-dom` | 6.30.3 | Routing + redirect after auth | Already installed |

### No New Dependencies Required

All packages needed for Phase 2 are already installed. Do not add new packages.

---

## Architecture Patterns

### Pattern 1: Dual-Mode Auth (Preserve This Phase)

The app uses `isSupabaseConfigured` to branch between real Supabase auth and mock auth. This pattern must be preserved in Phase 2 because the mock system backs other stores (contacts, deals, etc.) that are not yet migrated.

```typescript
// lib/supabase.ts — already correct, do not change
export const isSupabaseConfigured =
  typeof supabaseUrl === 'string' && supabaseUrl.startsWith('https://') &&
  typeof supabaseAnonKey === 'string' && supabaseAnonKey.length > 10

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl!, supabaseAnonKey!)
  : null
```

The SEC-06 warning should trigger only when `isSupabaseConfigured` is false AND the app is running in development mode:

```typescript
// lib/supabase.ts — add after isSupabaseConfigured declaration
if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[CRM] Supabase env vars missing or invalid. Running in mock/demo mode.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local to enable real auth.'
  )
}
```

### Pattern 2: isLoadingAuth Race Condition Guard

**The problem:** `initSupabaseAuth()` is called in a `useEffect` in App.tsx. On cold load, `onAuthStateChange` fires asynchronously. ProtectedRoute evaluates `isAuthenticated()` synchronously before that event fires, sees no session, and redirects to `/login` — even for an authenticated user.

**The fix requires two changes:**

Change 1 — Initialize `isLoadingAuth` as `true` in authStore:
```typescript
// authStore.ts — change default value
isLoadingAuth: true,  // was: false
```

Change 2 — ProtectedRoute must suspend until auth resolves:
```typescript
// components/auth/ProtectedRoute.tsx
export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const isLoadingAuth = useAuthStore((s) => s.isLoadingAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const currentUser = useAuthStore((s) => s.currentUser)

  // Do NOT redirect until Supabase has fired the first auth event
  if (isLoadingAuth) {
    return null  // or a loading spinner — renders nothing, no redirect
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  // ... permission check unchanged
}
```

**Critical:** `isLoadingAuth` must be set to `false` inside `onAuthStateChange` on the FIRST event, not in `getSession()`. The `getSession()` path in `initSupabaseAuth()` currently sets it to false too early — before `onAuthStateChange` fires. The correct pattern:

```typescript
export async function initSupabaseAuth() {
  if (!isSupabaseConfigured || !supabase) {
    // In mock mode, auth is synchronous — no loading state needed
    useAuthStore.getState().setIsLoadingAuth(false)
    return
  }

  // isLoadingAuth is already true (default) — do not set it here

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    // First event resolves the loading state
    useAuthStore.getState().setIsLoadingAuth(false)

    if (event === 'PASSWORD_RECOVERY') {
      // Navigate to reset-password page — see Pattern 4
      return
    }

    useAuthStore.getState().setSupabaseSession(session)
    if (session?.user) {
      const sbUser = session.user
      useAuthStore.getState().setCurrentUser({
        id: sbUser.id,
        name: sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? 'User',
        email: sbUser.email ?? '',
        role: (sbUser.user_metadata?.role ?? 'sales_rep') as UserRole,
        jobTitle: sbUser.user_metadata?.job_title ?? '',
        organizationId: sbUser.user_metadata?.org_id,
        createdAt: sbUser.created_at,
        isActive: true,
        updatedAt: sbUser.updated_at ?? sbUser.created_at,
      })
    } else {
      useAuthStore.getState().setCurrentUser(null)
    }
  })

  // Return unsubscribe function for cleanup if needed
  return () => subscription.unsubscribe()
}
```

**Why `onAuthStateChange` fires first, not `getSession`:** Supabase v2 guarantees `onAuthStateChange` fires with `INITIAL_SESSION` event synchronously-ish on startup, before any network request completes. `getSession()` is a separate call that may resolve after `onAuthStateChange`. Removing the separate `getSession()` call and relying solely on `onAuthStateChange` is the recommended pattern in Supabase v2 docs. The `INITIAL_SESSION` event carries the session if one exists.

### Pattern 3: Logout — Must Call signOut

The current `logout()` only clears Zustand state. This leaves the Supabase session cookie alive, meaning the user is still authenticated in Supabase's eyes. After pressing Back in the browser, `onAuthStateChange` would re-hydrate the session.

```typescript
// authStore.ts — new async logout action
logout: async () => {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut()
    // onAuthStateChange fires SIGNED_OUT event, which sets currentUser to null
    // We also clear local state defensively:
  }
  set({
    currentUser: null,
    session: null,
    supabaseSession: null,
    organization: null,
  })
},
```

The `logout` action signature must change from `() => void` to `() => Promise<void>`. All callers (Layout, profile page, etc.) must be updated to `await authStore.logout()`.

**Zustand persist partialize:** `supabaseSession` must not be persisted, or if it is, must be cleared on signOut. The current partialize includes `supabaseSession` — this should be removed since Supabase manages session persistence via its own storage (localStorage key `sb-<ref>-auth-token`).

```typescript
// authStore.ts — remove supabaseSession from partialize
partialize: (state) => ({
  currentUser: state.currentUser,
  session: state.session,
  organization: state.organization,
  // supabaseSession: REMOVED — Supabase manages this via its own storage
  users: state.users,
  passwords: state.passwords,
  invitations: state.invitations,
}),
```

### Pattern 4: Password Reset Flow

The reset flow has two UI states:

**State A — Request reset email:**
- New page at `/forgot-password`
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Shows "check your email" confirmation

**State B — Set new password (after clicking email link):**
- New page at `/reset-password`
- Supabase redirects to this URL with access token in hash fragment
- `onAuthStateChange` fires `PASSWORD_RECOVERY` event when the page loads with the token
- Page shows a "new password" form
- On submit: `supabase.auth.updateUser({ password: newPassword })`
- On success: redirect to `/`

```typescript
// In onAuthStateChange (inside initSupabaseAuth):
if (event === 'PASSWORD_RECOVERY') {
  // Signal to the app that we're in password recovery mode
  // Option A: use a router navigate (requires router context — messy from outside React)
  // Option B: set a flag in the store
  useAuthStore.getState().set({ isPasswordRecovery: true })
}
```

The cleanest approach for this project: handle `PASSWORD_RECOVERY` by navigating to `/reset-password` using `window.location.replace('/reset-password')` from within `initSupabaseAuth`. The reset-password page reads the event and shows the form. After `updateUser` succeeds, it calls `window.location.replace('/')`.

**Why window.location instead of React Router navigate:** `initSupabaseAuth` runs outside the React component tree (called in `useEffect` in App.tsx, but the function itself is outside). React Router's `navigate` function is not available outside components. `window.location.replace` is the standard approach used in Supabase docs for this case.

### Pattern 5: Email Verification State

After `signUp`, Supabase does NOT create a session until the email is verified (when `confirmations` are required in the Supabase project settings). The `Register.tsx:success` state already handles this correctly — it shows "check your email" and does not navigate to `/`.

However: if the Supabase project has "Enable email confirmations" turned off, `signUp` immediately returns a session. The UI should handle both cases. The current code only handles the email-confirmation path (shows success screen and stops). If a session is returned immediately, it should navigate to `/`.

```typescript
// Register.tsx — improved signUp handler
const { data, error: sbError } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { full_name: name, org_name: orgName } },
})
setLoading(false)
if (sbError) {
  setError(sbError.message)
} else if (data.session) {
  // Email confirmations disabled — user is immediately logged in
  navigate('/')
} else {
  // Email confirmation required — show "check your email"
  setSuccess(true)
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session storage across tabs | Custom BroadcastChannel sync | `supabase.auth` built-in | Supabase SDK handles cross-tab sync via storage events automatically |
| JWT refresh | Custom refresh timer | `supabase.auth` built-in | SDK auto-refreshes before expiry; manual timers cause double-refresh conflicts |
| Password hashing | `simpleHash` (existing) | Supabase Auth | djb2 is not a password hash; Supabase uses bcrypt server-side |
| PKCE flow for OAuth | Custom code_verifier | Supabase SDK | SDK handles PKCE automatically when configured |
| Token storage | Manual localStorage writes | Supabase SDK | SDK stores tokens under `sb-<ref>-auth-token` — do not duplicate or conflict |

---

## Common Pitfalls

### Pitfall 1: Double-calling getSession + onAuthStateChange

**What goes wrong:** The current `initSupabaseAuth()` calls both `supabase.auth.getSession()` AND registers `onAuthStateChange`. In Supabase v2, `onAuthStateChange` fires `INITIAL_SESSION` on startup with the same data as `getSession()`. Calling both means `setCurrentUser` fires twice on load, and `setIsLoadingAuth(false)` fires in the `getSession` callback before `onAuthStateChange` fires — which means the loading guard clears too early on cold load.

**How to avoid:** Remove the `getSession()` block from `initSupabaseAuth()`. Rely entirely on `onAuthStateChange` with the `INITIAL_SESSION` event. Mark `isLoadingAuth` as false inside the first `onAuthStateChange` callback.

**Warning signs:** Flash of /login on cold load for authenticated users; auth state appearing to reset.

### Pitfall 2: logout() is Synchronous in TypeScript Interface

**What goes wrong:** `AuthState.logout` is typed as `() => void`. Making it async (to call `supabase.auth.signOut()`) requires updating the TypeScript interface AND all call sites. If the interface is not updated, TypeScript will not complain (Promise<void> is assignable to void in most contexts), but the UI may navigate to /login before signOut completes, leaving a brief window where the session is still valid.

**How to avoid:** Change the `logout` type to `() => Promise<void>` in the `AuthState` interface. Update all call sites with `await`.

**Warning signs:** Network tab shows signOut request starting after redirect; browser Back button restores authenticated state.

### Pitfall 3: isLoadingAuth Persisted in Zustand

**What goes wrong:** `isLoadingAuth` is included in the current Zustand `partialize` (implicitly, since it is in state). If `isLoadingAuth: false` is persisted to localStorage from a previous session, it initializes as `false` on next cold load — bypassing the race condition guard entirely.

**How to avoid:** `isLoadingAuth` must NOT be in `partialize`. Since the current partialize explicitly lists keys, verify `isLoadingAuth` is not in the list. It is not currently listed — this is already correct. But verify after any refactor.

**Warning signs:** `isLoadingAuth` defaults to `false` in hydrated state; flash-of-login on refresh.

### Pitfall 4: Supabase Session in Zustand persist Conflicts with SDK Storage

**What goes wrong:** The current `partialize` includes `supabaseSession`. Supabase SDK stores the session in localStorage under `sb-<ref>-auth-token`. If Zustand persist also stores the session under `crm_auth`, there are two copies. After `signOut`, the SDK clears its own storage, but the Zustand persisted copy remains. On next init, `getSession()` correctly returns null (SDK cleared its copy), but if the persisted `supabaseSession` is read somewhere, stale auth state can leak.

**How to avoid:** Remove `supabaseSession` from `partialize`. It is only needed transiently in memory.

**Warning signs:** After signOut + page refresh, user briefly sees dashboard before redirect.

### Pitfall 5: redirectTo Must Match Supabase Allowed URLs

**What goes wrong:** `supabase.auth.resetPasswordForEmail(email, { redirectTo: '...' })` — if the redirect URL is not in the list of allowed redirect URLs configured in the Supabase Dashboard (Authentication > URL Configuration), Supabase silently uses the default Site URL instead of the specified URL.

**How to avoid:** Ensure `http://localhost:5173` (dev) and the production domain are both in Supabase's allowed redirect list. The `redirectTo` for local dev should be `http://localhost:5173/reset-password`. Document this as a setup step.

**Warning signs:** Password reset link redirects to wrong URL; reset-password page never receives the token.

### Pitfall 6: PASSWORD_RECOVERY Event Fires Before Router is Ready

**What goes wrong:** `initSupabaseAuth()` is called inside a `useEffect` in App, but `onAuthStateChange` subscription is set up asynchronously. If the PASSWORD_RECOVERY event fires before the subscription is established (race condition on deep link open), the event is missed.

**How to avoid:** Supabase v2 guarantees that `onAuthStateChange` is called with the current state synchronously after subscription registration if a session exists. For PASSWORD_RECOVERY specifically, the token is in the URL hash — if the subscription is set up within the same JS task as navigation, the event will fire. The standard mitigation: check `window.location.hash` on the reset-password page as a fallback, or use `supabase.auth.getSession()` on that specific page.

---

## Code Examples

### Auth State Change — Recommended Pattern (Supabase v2)

```typescript
// Source: Supabase Auth JS docs — onAuthStateChange
// https://supabase.com/docs/reference/javascript/auth-onauthstatechange
export async function initSupabaseAuth() {
  if (!isSupabaseConfigured || !supabase) {
    useAuthStore.getState().setIsLoadingAuth(false)
    return
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      // Always resolve loading on first event
      useAuthStore.getState().setIsLoadingAuth(false)

      if (event === 'PASSWORD_RECOVERY') {
        window.location.replace('/reset-password')
        return
      }

      useAuthStore.getState().setSupabaseSession(session)
      if (session?.user) {
        // Map Supabase user to AuthUser shape
      } else {
        useAuthStore.getState().setCurrentUser(null)
      }
    }
  )
  // Store subscription for cleanup if component unmounts (App.tsx useEffect cleanup)
  return subscription
}
```

### Password Reset — Request Email

```typescript
// Source: Supabase Auth JS docs — resetPasswordForEmail
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password`,
})
```

### Password Reset — Update Password

```typescript
// Source: Supabase Auth JS docs — updateUser
// Called on /reset-password page after PASSWORD_RECOVERY event
const { error } = await supabase.auth.updateUser({
  password: newPassword,
})
if (!error) {
  navigate('/')
}
```

### Logout — Complete Cleanup

```typescript
// authStore.ts logout action
logout: async () => {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut()
  }
  set({
    currentUser: null,
    session: null,
    supabaseSession: null,
    organization: null,
  })
},
```

### ProtectedRoute — With Loading Guard

```typescript
export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const isLoadingAuth = useAuthStore((s) => s.isLoadingAuth)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const currentUser = useAuthStore((s) => s.currentUser)

  if (isLoadingAuth) {
    return null  // Suspend rendering — no redirect until auth resolves
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission && currentUser && !hasPermission(currentUser.role, requiredPermission)) {
    // ... existing permission denied UI
  }

  return <>{children}</>
}
```

---

## New Files Required

| File | Purpose |
|------|---------|
| `src/pages/ForgotPassword.tsx` | Step 1 of password reset: email input form |
| `src/pages/ResetPassword.tsx` | Step 2 of password reset: new password form (shown after PASSWORD_RECOVERY event) |

Both pages follow the same visual pattern as Login.tsx and Register.tsx (centered card, same background).

New routes required in App.tsx:
```typescript
<Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
```

Link required on Login.tsx:
```tsx
// Below the password field, above the submit button
<div className="text-right">
  <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-brand-400 transition-colors">
    Forgot password?
  </Link>
</div>
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | npm scripts, Vite | N/A (dev env) | — | — |
| `@supabase/supabase-js` | All auth calls | Already in package.json | 2.100.1 | Mock mode (existing) |
| Supabase project + env vars | Real auth flows | Required from developer | — | Mock mode runs without them |
| VITE_SUPABASE_URL | `lib/supabase.ts` | Dev: needs .env.local | — | SEC-06 warning if missing |
| VITE_SUPABASE_ANON_KEY | `lib/supabase.ts` | Dev: needs .env.local | — | SEC-06 warning if missing |

**Missing dependencies with no fallback:**
- A real Supabase project is required to test AUTH-01 through AUTH-05. The mock mode tests the UI shapes but not the actual auth flows. The developer must have a `.env.local` with valid Supabase credentials to verify the Supabase code paths.

**Supabase Dashboard settings the developer must configure:**
- Authentication > Email > "Enable email confirmations" — should be ON for AUTH-02
- Authentication > URL Configuration > Site URL — must match local dev URL (`http://localhost:5173`)
- Authentication > URL Configuration > Redirect URLs — must include `http://localhost:5173/reset-password`

---

## Validation Architecture

nyquist_validation is enabled in config.json.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (not yet installed — Wave 0 gap) |
| Config file | `vite.config.ts` (add `test` block) or `vitest.config.ts` |
| Supporting libraries | `@testing-library/react` 16.3.2, `@testing-library/user-event` 14.6.1, `jsdom` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

No test infrastructure currently exists in the project (no vitest config, no test directory, no test scripts in package.json). Phase 2 is the right time to establish it because TEST-01 is a v1 requirement and these auth functions are the first pure-ish logic worth unit-testing.

However, most of Phase 2 involves **UI wiring and Supabase SDK calls**. These are integration-level tests that require either:
- A real Supabase project (slow, flaky, not unit tests)
- Mocking the Supabase client (feasible for unit tests)

The recommended approach: mock `@supabase/supabase-js` at the module level, test the store actions and component behavior in isolation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| AUTH-01 | `signUp()` called with email/password on Register submit | Unit (Vitest + RTL) | `npx vitest run tests/auth/Register.test.tsx` | No — Wave 0 |
| AUTH-02 | Success screen shown when signUp returns no session | Unit (Vitest + RTL) | `npx vitest run tests/auth/Register.test.tsx` | No — Wave 0 |
| AUTH-03 | `resetPasswordForEmail()` called on ForgotPassword submit | Unit (Vitest + RTL) | `npx vitest run tests/auth/ForgotPassword.test.tsx` | No — Wave 0 |
| AUTH-03 | `updateUser()` called on ResetPassword submit | Unit (Vitest + RTL) | `npx vitest run tests/auth/ResetPassword.test.tsx` | No — Wave 0 |
| AUTH-04 | ProtectedRoute renders null (not redirect) while isLoadingAuth=true | Unit (Vitest + RTL) | `npx vitest run tests/auth/ProtectedRoute.test.tsx` | No — Wave 0 |
| AUTH-04 | ProtectedRoute redirects to /login when isLoadingAuth=false and not authenticated | Unit (Vitest + RTL) | `npx vitest run tests/auth/ProtectedRoute.test.tsx` | No — Wave 0 |
| AUTH-05 | `signOut()` called and store cleared on logout | Unit (Vitest) | `npx vitest run tests/auth/authStore.test.ts` | No — Wave 0 |
| SEC-01 | `simpleHash` and `passwords` not used when Supabase configured | Manual inspection | N/A — code review | N/A |
| SEC-06 | `console.warn` fires in dev when env vars absent | Unit (Vitest) | `npx vitest run tests/lib/supabase.test.ts` | No — Wave 0 |

**Manual-only tests (cannot be automated without live Supabase):**
- Email actually delivered to inbox (AUTH-02)
- Password reset link in email navigates correctly (AUTH-03)
- Session persists after hard refresh in real browser (AUTH-04)
- Back button does not restore session after signOut in real browser (AUTH-05)

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (once framework is installed)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + manual browser smoke test before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest` and `@testing-library/react`, `@testing-library/user-event`, `jsdom` not installed — install command: `npm install -D vitest @testing-library/react @testing-library/user-event jsdom`
- [ ] `vite.config.ts` needs `test` block added for jsdom environment
- [ ] `tests/auth/ProtectedRoute.test.tsx` — covers AUTH-04 (most critical — race condition guard)
- [ ] `tests/auth/authStore.test.ts` — covers AUTH-05 (logout signOut call)
- [ ] `tests/auth/Register.test.tsx` — covers AUTH-01, AUTH-02
- [ ] `tests/auth/ForgotPassword.test.tsx` — covers AUTH-03 (step 1)
- [ ] `tests/auth/ResetPassword.test.tsx` — covers AUTH-03 (step 2)
- [ ] `tests/lib/supabase.test.ts` — covers SEC-06 (console.warn)
- [ ] `tests/setup.ts` — vitest setup file (import @testing-library/jest-dom matchers)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `supabase.auth.getSession()` + `onAuthStateChange` | `onAuthStateChange` only with `INITIAL_SESSION` event | Supabase JS v2 | Removes double-call pattern |
| `auth.user()` (v1 sync getter) | `onAuthStateChange` + `getSession()` async | Supabase JS v2 | All user access must be async-aware |
| Implicit OAuth flow | PKCE (Auth Code) flow | Supabase JS v2 | More secure; relevant for Phase 8 (Gmail) |

---

## Open Questions

1. **Are email confirmations enabled on the Supabase project?**
   - What we know: The Register.tsx success screen assumes confirmation is required
   - What's unclear: The actual Supabase project setting — developer must verify
   - Recommendation: Plan for both paths (immediate session vs. confirmation required) as shown in Pattern 5 above

2. **Should SEED_USERS be removed in Phase 2 or Phase 5?**
   - What we know: SEC-01 says "passwords never stored locally" — SEED_USERS + simpleHash violate this in mock mode
   - What's unclear: Phase 5 data migration depends on the mock users being present for development until Supabase stores are wired
   - Recommendation: Leave SEED_USERS in place through Phase 5. Add a clearly marked comment. SEC-01 is satisfied for the Supabase code path in Phase 2 (no passwords stored when Supabase is configured).

3. **Where should the `initSupabaseAuth` subscription be cleaned up?**
   - What we know: `supabase.auth.onAuthStateChange` returns a subscription with `.unsubscribe()`. Currently not stored or cleaned up.
   - What's unclear: For a single-page app that never unmounts App, this is typically not an issue
   - Recommendation: Return subscription from `initSupabaseAuth`, store in a ref in App.tsx, call `subscription.unsubscribe()` in the useEffect cleanup function. LOW priority but correct practice.

---

## Sources

### Primary (HIGH confidence)
- Supabase Auth JS v2 official docs: https://supabase.com/docs/reference/javascript/auth-signup
- Supabase Auth state change docs: https://supabase.com/docs/reference/javascript/auth-onauthstatechange
- Supabase password recovery docs: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- Existing codebase — `src/store/authStore.ts`, `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/App.tsx`

### Secondary (MEDIUM confidence)
- `.planning/research/supabase-multitenant.md` — prior research on this project's architecture
- Package registry: `@supabase/supabase-js` current version 2.101.0, `vitest` 4.1.2

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed, versions verified against npm registry
- Architecture patterns: HIGH — based on direct codebase reading + Supabase v2 documented behavior
- Pitfalls: HIGH — derived from reading the actual code and identifying specific bugs (isLoadingAuth default, double-call pattern, missing signOut)
- Validation Architecture: MEDIUM — test framework not yet installed, test structure is standard RTL/Vitest pattern

**Research date:** 2026-03-31
**Valid until:** 2026-06-30 (Supabase Auth JS v2 API is stable)
