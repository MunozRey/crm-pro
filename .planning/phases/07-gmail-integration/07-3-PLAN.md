---
phase: 07-gmail-integration
plan: 3
type: execute
wave: 2
depends_on:
  - "07-1"
  - "07-2"
files_modified:
  - src/pages/GmailCallback.tsx
  - src/App.tsx
  - src/hooks/useDataInit.ts
autonomous: true
requirements:
  - GMAIL-01
  - GMAIL-02
  - GMAIL-03

must_haves:
  truths:
    - "Visiting /auth/gmail/callback with ?code=...&state=... shows a full-screen dark spinner ('Connecting Gmail...')"
    - "After successful exchange the user is redirected to /inbox"
    - "After a failed exchange the user is redirected to /inbox with an error toast"
    - "CSRF state mismatch (sessionStorage state != URL state param) causes failure redirect, not a crash"
    - "On app load, if gmailAddress is in emailStore, the app silently calls gmail-refresh-token to restore the in-memory access token"
  artifacts:
    - path: "src/pages/GmailCallback.tsx"
      provides: "OAuth callback page: reads code+state from URL, calls gmail-oauth-exchange Edge Function, sets in-memory token, redirects"
      exports: ["GmailCallback"]
    - path: "src/App.tsx"
      provides: "Route /auth/gmail/callback registered as a public route"
      contains: "/auth/gmail/callback"
    - path: "src/hooks/useDataInit.ts"
      provides: "Silent Gmail token refresh on app load when gmailAddress is persisted"
  key_links:
    - from: "src/pages/GmailCallback.tsx"
      to: "supabase/functions/gmail-oauth-exchange"
      via: "supabase.functions.invoke('gmail-oauth-exchange', { body: { code, code_verifier, redirect_uri } })"
      pattern: "gmail-oauth-exchange"
    - from: "src/hooks/useDataInit.ts"
      to: "supabase/functions/gmail-refresh-token"
      via: "supabase.functions.invoke('gmail-refresh-token')"
      pattern: "gmail-refresh-token"
    - from: "src/pages/GmailCallback.tsx"
      to: "src/contexts/GmailTokenContext.tsx"
      via: "useGmailToken().setGmailToken()"
      pattern: "setGmailToken"
---

<objective>
Wire the OAuth redirect loop: create the `/auth/gmail/callback` page that completes the code exchange after Google redirects back, register it as a public route in App.tsx, and add silent token refresh on app load to useDataInit.ts.

Purpose: Plans 1 and 2 built the primitives (PKCE generator, Edge Functions, token context). This plan closes the loop — the user can now fully authenticate and have their session restored on reload.

Output:
- `src/pages/GmailCallback.tsx` — callback page (full-screen spinner, code exchange, redirect)
- `src/App.tsx` — `/auth/gmail/callback` route added as a public route
- `src/hooks/useDataInit.ts` — silent refresh call on app start when gmailAddress is persisted
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-gmail-integration/07-CONTEXT.md
@.planning/phases/07-gmail-integration/07-1-SUMMARY.md
@.planning/phases/07-gmail-integration/07-2-SUMMARY.md

<interfaces>
<!-- GmailTokenContext API (created in Plan 07-1): -->
```typescript
// src/contexts/GmailTokenContext.tsx
export function useGmailToken(): {
  accessToken: string | null
  expiresAt: number | null
  setGmailToken: (accessToken: string, expiresAt: number) => void
  clearGmailToken: () => void
  isTokenValid: () => boolean
}
```

<!-- emailStore API (updated in Plan 07-1): -->
```typescript
// src/store/emailStore.ts
gmailAddress: string | null
setGmailAddress: (addr: string | null) => void
disconnectGmail: () => void
```

<!-- supabase client (existing pattern): -->
```typescript
import { supabase, isSupabaseConfigured } from '../lib/supabase'
// Call Edge Function:
const { data, error } = await supabase.functions.invoke('gmail-oauth-exchange', {
  body: { code, code_verifier, redirect_uri },
})
```

<!-- App.tsx route pattern (public routes): -->
```tsx
<Route path="/login" element={<Login />} />
<Route path="/register" element={<Register />} />
// Add:
<Route path="/auth/gmail/callback" element={<GmailCallback />} />
```

<!-- useDataInit.ts: already uses isSupabaseConfigured guard and fires on currentUser mount -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create GmailCallback page</name>
  <files>src/pages/GmailCallback.tsx</files>
  <read_first>
    - src/pages/OrgSetup.tsx (reference for a full-page centered component with the app's dark glass aesthetic)
    - src/contexts/GmailTokenContext.tsx (useGmailToken hook API — created in Plan 07-1)
    - src/store/emailStore.ts (setGmailAddress signature — updated in Plan 07-1)
    - src/lib/supabase.ts (import supabase for functions.invoke)
    - src/store/toastStore.ts (toast.error signature)
  </read_first>
  <action>
Create `src/pages/GmailCallback.tsx`. This page is shown for ~1-2 seconds while the Edge Function exchange runs.

Full implementation:

```tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useGmailToken } from '../contexts/GmailTokenContext'
import { useEmailStore } from '../store/emailStore'
import { supabase } from '../lib/supabase'
import { toast } from '../store/toastStore'

const REDIRECT_URI =
  import.meta.env.DEV
    ? 'http://localhost:5173/auth/gmail/callback'
    : `${window.location.origin}/auth/gmail/callback`

export function GmailCallback() {
  const navigate = useNavigate()
  const { setGmailToken } = useGmailToken()
  const setGmailAddress = useEmailStore((s) => s.setGmailAddress)
  const didRun = useRef(false)

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    async function exchange() {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const returnedState = params.get('state')

      // CSRF check: state must match what we stored before the redirect
      const storedState = sessionStorage.getItem('gmail_oauth_state')
      const codeVerifier = sessionStorage.getItem('gmail_oauth_verifier')

      if (!code || !returnedState || !storedState || !codeVerifier) {
        toast.error('Gmail connection failed — missing OAuth parameters')
        navigate('/inbox', { replace: true })
        return
      }

      if (returnedState !== storedState) {
        toast.error('Gmail connection failed — state mismatch (possible CSRF)')
        navigate('/inbox', { replace: true })
        return
      }

      // Clear sessionStorage — verifier + state are single-use
      sessionStorage.removeItem('gmail_oauth_state')
      sessionStorage.removeItem('gmail_oauth_verifier')

      try {
        const { data, error } = await supabase.functions.invoke('gmail-oauth-exchange', {
          body: { code, code_verifier: codeVerifier, redirect_uri: REDIRECT_URI },
        })

        if (error || !data?.access_token) {
          toast.error('Gmail connection failed — try again')
          navigate('/inbox', { replace: true })
          return
        }

        // Store access token in memory only (per D-08)
        const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
        setGmailToken(data.access_token, expiresAt)

        // Persist only the email address (per D-09)
        if (data.email_address) {
          setGmailAddress(data.email_address)
        }

        navigate('/inbox', { replace: true })
      } catch {
        toast.error('Gmail connection failed — try again')
        navigate('/inbox', { replace: true })
      }
    }

    exchange()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
        <p className="text-slate-300 text-sm font-medium">Connecting Gmail...</p>
      </div>
    </div>
  )
}
```

**Important:** Use `useRef(didRun)` guard — React Strict Mode double-invokes effects in development, which would call the Edge Function twice with the same (now-invalid) code.
  </action>
  <verify>
    <automated>grep -n "gmail_oauth_state\|gmail_oauth_verifier\|setGmailToken\|gmail-oauth-exchange\|state mismatch\|Connecting Gmail" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/pages/GmailCallback.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `src/pages/GmailCallback.tsx` exists
    - `grep "export function GmailCallback" src/pages/GmailCallback.tsx` returns a match
    - `grep "gmail_oauth_state" src/pages/GmailCallback.tsx` returns a match (state CSRF check)
    - `grep "returnedState !== storedState" src/pages/GmailCallback.tsx` returns a match
    - `grep "sessionStorage.removeItem" src/pages/GmailCallback.tsx` returns 2 matches (both keys cleared after use)
    - `grep "gmail-oauth-exchange" src/pages/GmailCallback.tsx` returns a match
    - `grep "setGmailToken" src/pages/GmailCallback.tsx` returns a match (token stored in context)
    - `grep "localStorage" src/pages/GmailCallback.tsx` returns NO match (no localStorage usage)
    - `grep "navigate.*inbox" src/pages/GmailCallback.tsx` returns a match
    - `grep "Connecting Gmail" src/pages/GmailCallback.tsx` returns a match
  </acceptance_criteria>
  <done>GmailCallback page shows spinner, validates CSRF state, calls exchange Edge Function, stores access token in context, persists email address, redirects to /inbox. On error, redirects to /inbox with toast.</done>
</task>

<task type="auto">
  <name>Task 2: Register /auth/gmail/callback route in App.tsx + add silent refresh to useDataInit.ts</name>
  <files>src/App.tsx, src/hooks/useDataInit.ts</files>
  <read_first>
    - src/App.tsx (read the full file — find where public routes are defined and where to add GmailCallback import)
    - src/hooks/useDataInit.ts (read the full file — find where to add silent refresh logic)
    - src/contexts/GmailTokenContext.tsx (useGmailToken API)
    - src/store/emailStore.ts (gmailAddress field in the store)
    - src/lib/supabase.ts (supabase.functions.invoke pattern)
  </read_first>
  <action>
**In `src/App.tsx`:**

1. Add import: `import { GmailCallback } from './pages/GmailCallback'`
2. In the `<Routes>` block, add as a public route (alongside /login, /register, etc.) BEFORE the protected routes:
   ```tsx
   <Route path="/auth/gmail/callback" element={<GmailCallback />} />
   ```
   This route must NOT be wrapped in `<ProtectedRoute>` — the user is mid-auth flow when they land here.

**In `src/hooks/useDataInit.ts`:**

Add silent Gmail token refresh on app load. When `gmailAddress` is in the store, the user previously connected Gmail. Silently restore the in-memory access token so they don't need to reconnect.

Add to the top of the file:
```typescript
import { useEmailStore } from '../store/emailStore'
import { useGmailToken } from '../contexts/GmailTokenContext'
import { supabase } from '../lib/supabase'
```

Inside `useDataInit()`, after the existing `const currentUser = ...` line, add:
```typescript
const gmailAddress = useEmailStore((s) => s.gmailAddress)
const { setGmailToken } = useGmailToken()
```

Inside the `useEffect`, after `didInit.current = true` and AFTER `isSupabaseConfigured` is verified, add the silent refresh call:
```typescript
// Silent Gmail token refresh (D-11): restore in-memory access token if user was connected
if (gmailAddress && isSupabaseConfigured) {
  supabase.functions.invoke('gmail-refresh-token').then(({ data, error }) => {
    if (!error && data?.access_token) {
      const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000
      setGmailToken(data.access_token, expiresAt)
    }
    // If refresh fails (e.g. token revoked), stay silent — user will see "Connect Gmail" in Inbox
  })
}
```

Do NOT await the refresh call — it runs in the background and must not block the rest of useDataInit (contacts, deals, etc. load immediately).
  </action>
  <verify>
    <automated>grep -n "GmailCallback\|auth/gmail/callback" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/App.tsx && grep -n "gmail-refresh-token\|gmailAddress\|setGmailToken" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/hooks/useDataInit.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "GmailCallback" src/App.tsx` returns 2 matches (import + route element)
    - `grep "auth/gmail/callback" src/App.tsx` returns a match
    - `grep "ProtectedRoute.*GmailCallback\|GmailCallback.*ProtectedRoute" src/App.tsx` returns NO match (not wrapped in ProtectedRoute)
    - `grep "gmail-refresh-token" src/hooks/useDataInit.ts` returns a match
    - `grep "gmailAddress" src/hooks/useDataInit.ts` returns a match
    - `grep "setGmailToken" src/hooks/useDataInit.ts` returns a match
    - `grep "await.*gmail-refresh-token\|await supabase.functions.invoke.*gmail-refresh" src/hooks/useDataInit.ts` returns NO match (fire-and-forget, not awaited)
    - `npx tsc --noEmit 2>&1 | grep -E "App.tsx|useDataInit"` returns no errors
  </acceptance_criteria>
  <done>/auth/gmail/callback is a public route accessible mid-OAuth flow. On app load with a previously connected Gmail account, the access token is silently restored in the background without blocking other data fetches.</done>
</task>

</tasks>

<verification>
After all tasks:

1. `grep "auth/gmail/callback" src/App.tsx` — has output
2. `grep "GmailCallback" src/App.tsx` — has output (import + usage)
3. `grep "gmail-refresh-token" src/hooks/useDataInit.ts` — has output
4. `npx tsc --noEmit` — exits 0

Manual verification:
- Start dev server: `npm run dev`
- Navigate to `http://localhost:5173/auth/gmail/callback` — should show dark spinner page without auth redirect
</verification>

<success_criteria>
- GmailCallback page handles all edge cases: missing params, CSRF state mismatch, Edge Function failure
- Route /auth/gmail/callback is public (not behind ProtectedRoute)
- Silent refresh fires on app load when gmailAddress is stored, is fire-and-forget (does not block other data loading)
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/phases/07-gmail-integration/07-3-SUMMARY.md`
</output>
