---
phase: 07-gmail-integration
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/gmailService.ts
  - src/store/emailStore.ts
  - src/contexts/GmailTokenContext.tsx
autonomous: true
requirements:
  - GMAIL-01
  - SEC-05

must_haves:
  truths:
    - "Clicking Connect Gmail in the Inbox page initiates a redirect to accounts.google.com (not a popup)"
    - "sessionStorage keys gmail_oauth_state and gmail_code_verifier are set before the redirect"
    - "The access token is never written to localStorage (crm_emails key contains no accessToken field)"
    - "gmailAddress persists in localStorage; gmailTokens does not"
  artifacts:
    - path: "src/contexts/GmailTokenContext.tsx"
      provides: "In-memory access token provider with get/set/clear API"
      exports: ["GmailTokenProvider", "useGmailToken"]
    - path: "src/services/gmailService.ts"
      provides: "PKCE OAuth URL construction replacing requestGmailAccess/initTokenClient"
      exports: ["initiateGmailOAuth", "exchangeGmailCode", "refreshGmailToken"]
    - path: "src/store/emailStore.ts"
      provides: "emailStore with gmailTokens removed from persist partialize"
  key_links:
    - from: "src/contexts/GmailTokenContext.tsx"
      to: "src/App.tsx"
      via: "GmailTokenProvider wraps AppRoutes"
      pattern: "GmailTokenProvider"
    - from: "src/store/emailStore.ts"
      to: "localStorage crm_emails"
      via: "partialize"
      pattern: "partialize.*gmailAddress"
---

<objective>
Build the client-side foundation for Gmail OAuth: the PKCE initiation function that replaces `requestGmailAccess`/`initTokenClient`, the in-memory access token context, and the emailStore cleanup that removes tokens from localStorage.

Purpose: Everything in Plans 2-5 depends on the access token being available via `useGmailToken()` and the PKCE flow generating correct `code_verifier`/`code_challenge` values. This plan lays that groundwork.

Output:
- `src/contexts/GmailTokenContext.tsx` — React Context holding access token in memory only
- `src/services/gmailService.ts` — PKCE OAuth URL builder replacing the old implicit flow
- `src/store/emailStore.ts` — persist partialize updated: gmailTokens removed, gmailAddress kept; version bumped to 2 with migration
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/07-gmail-integration/07-CONTEXT.md

<interfaces>
<!-- Current emailStore partialize (src/store/emailStore.ts lines 182-187): -->
```typescript
partialize: (s) => ({
  emails: s.emails,
  gmailTokens: s.gmailTokens,  // MUST BE REMOVED per D-17
  gmailAddress: s.gmailAddress, // KEEP per D-18
}),
```

<!-- Current requestGmailAccess in src/services/gmailService.ts — REPLACE entirely -->
```typescript
// Lines 34-60: Uses initTokenClient (implicit flow) — delete this function
export function requestGmailAccess(clientId, onSuccess, onError): void
// Lines 62-68: Keep revokeGmailAccess as-is
```

<!-- New function signature to create: -->
```typescript
export async function initiateGmailOAuth(clientId: string): Promise<void>
// Generates PKCE verifier + challenge + state, stores in sessionStorage, redirects browser
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create GmailTokenContext — in-memory access token provider</name>
  <files>src/contexts/GmailTokenContext.tsx</files>
  <read_first>
    - src/store/emailStore.ts (understand current token shape: GmailTokens { accessToken, expiresAt })
    - src/types/index.ts (GmailTokens type definition)
  </read_first>
  <action>
Create `src/contexts/GmailTokenContext.tsx` as a new file. This context holds the Gmail access token in React state — it is NEVER persisted anywhere.

Implement:

```typescript
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface GmailTokenState {
  accessToken: string | null
  expiresAt: number | null
}

interface GmailTokenContextValue extends GmailTokenState {
  setGmailToken: (accessToken: string, expiresAt: number) => void
  clearGmailToken: () => void
  isTokenValid: () => boolean
}

const GmailTokenContext = createContext<GmailTokenContextValue | null>(null)

export function GmailTokenProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GmailTokenState>({ accessToken: null, expiresAt: null })

  const setGmailToken = useCallback((accessToken: string, expiresAt: number) => {
    setState({ accessToken, expiresAt })
  }, [])

  const clearGmailToken = useCallback(() => {
    setState({ accessToken: null, expiresAt: null })
  }, [])

  const isTokenValid = useCallback(() => {
    return !!state.accessToken && !!state.expiresAt && state.expiresAt > Date.now()
  }, [state])

  return (
    <GmailTokenContext.Provider value={{ ...state, setGmailToken, clearGmailToken, isTokenValid }}>
      {children}
    </GmailTokenContext.Provider>
  )
}

export function useGmailToken(): GmailTokenContextValue {
  const ctx = useContext(GmailTokenContext)
  if (!ctx) throw new Error('useGmailToken must be used within GmailTokenProvider')
  return ctx
}
```

Then wrap `AppRoutes` in `src/App.tsx` with `<GmailTokenProvider>`:
- Import `{ GmailTokenProvider }` from `'./contexts/GmailTokenContext'`
- Wrap the `<BrowserRouter>` children or at minimum wrap the `<Routes>` block so all pages can access the token via `useGmailToken()`
  </action>
  <verify>
    <automated>grep -n "GmailTokenProvider\|useGmailToken\|GmailTokenContext" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/contexts/GmailTokenContext.tsx | head -20</automated>
  </verify>
  <acceptance_criteria>
    - File `src/contexts/GmailTokenContext.tsx` exists
    - `grep "export function GmailTokenProvider" src/contexts/GmailTokenContext.tsx` returns a match
    - `grep "export function useGmailToken" src/contexts/GmailTokenContext.tsx` returns a match
    - `grep "GmailTokenProvider" src/App.tsx` returns a match (provider wired into App)
    - `grep "useState\|localStorage\|sessionStorage" src/contexts/GmailTokenContext.tsx` — no localStorage or sessionStorage reference (only useState)
  </acceptance_criteria>
  <done>GmailTokenProvider wraps the app; useGmailToken() hook is available to all pages; access token never touches persistent storage.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Replace requestGmailAccess with PKCE initiateGmailOAuth in gmailService.ts</name>
  <files>src/services/gmailService.ts</files>
  <read_first>
    - src/services/gmailService.ts (read the full file — understand current requestGmailAccess and revokeGmailAccess implementations to know exactly what to replace vs keep)
    - .planning/phases/07-gmail-integration/07-CONTEXT.md (D-05, D-06 decisions)
  </read_first>
  <action>
Replace the `requestGmailAccess` function and the `Window` global declaration for `initTokenClient` with a PKCE-based flow. Keep `revokeGmailAccess` and all REST API functions unchanged.

**Remove:**
- The `declare global { interface Window { google?: ... } }` block (no longer needed for initiation)
- The `isGISLoaded()` function
- The `requestGmailAccess()` function entirely

**Add these new exports** after the SCOPES constant:

```typescript
// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ─── Auth Code + PKCE initiation ─────────────────────────────────────────────

const REDIRECT_URI =
  import.meta.env.DEV
    ? 'http://localhost:5173/auth/gmail/callback'
    : `${window.location.origin}/auth/gmail/callback`

export async function initiateGmailOAuth(clientId: string): Promise<void> {
  // 1. Generate code_verifier: 64 random bytes → base64url
  const verifierBytes = new Uint8Array(64)
  crypto.getRandomValues(verifierBytes)
  const codeVerifier = base64urlEncode(verifierBytes)

  // 2. Generate code_challenge: SHA-256(verifier) → base64url
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier))
  const codeChallenge = base64urlEncode(new Uint8Array(digest))

  // 3. Generate state nonce for CSRF protection
  const stateBytes = new Uint8Array(16)
  crypto.getRandomValues(stateBytes)
  const state = base64urlEncode(stateBytes)

  // 4. Store verifier + state in sessionStorage (survive the redirect, not persistent)
  sessionStorage.setItem('gmail_oauth_verifier', codeVerifier)
  sessionStorage.setItem('gmail_oauth_state', state)

  // 5. Build authorization URL manually (GIS initCodeClient does not support PKCE in redirect mode)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}
```

Also keep `revokeGmailAccess` but update it to not require an access token (it will be called with the in-memory token passed as an argument — no change needed to its signature, just preserve it).
  </action>
  <verify>
    <automated>grep -n "initiateGmailOAuth\|code_challenge\|gmail_oauth_verifier\|gmail_oauth_state\|requestGmailAccess" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/services/gmailService.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "export async function initiateGmailOAuth" src/services/gmailService.ts` returns a match
    - `grep "requestGmailAccess" src/services/gmailService.ts` returns NO match (function removed)
    - `grep "initTokenClient" src/services/gmailService.ts` returns NO match
    - `grep "gmail_oauth_verifier" src/services/gmailService.ts` returns a match
    - `grep "gmail_oauth_state" src/services/gmailService.ts` returns a match
    - `grep "code_challenge_method.*S256" src/services/gmailService.ts` returns a match
    - `grep "access_type.*offline" src/services/gmailService.ts` returns a match
    - `grep "prompt.*consent" src/services/gmailService.ts` returns a match
  </acceptance_criteria>
  <done>initiateGmailOAuth() generates PKCE params, stores verifier+state in sessionStorage, redirects browser to Google OAuth consent screen. Old initTokenClient-based flow fully removed.</done>
</task>

<task type="auto">
  <name>Task 3: Clean emailStore — remove gmailTokens from persist, bump version</name>
  <files>src/store/emailStore.ts</files>
  <read_first>
    - src/store/emailStore.ts (read the full file before any edits — understand current state shape, partialize, and all methods that reference gmailTokens)
  </read_first>
  <action>
Refactor `emailStore.ts` to remove the gmailTokens field from the store entirely (the access token now lives in GmailTokenContext) and update all methods that used to read from `gmailTokens`.

**Changes required:**

1. **Remove from interface `EmailStore`:**
   - `gmailTokens: GmailTokens | null`
   - `setGmailTokens: (tokens: GmailTokens | null) => void`
   - Remove `GmailTokens` from the import (if it becomes unused; keep if CRMEmail still uses it)

2. **Remove from initial state:**
   - `gmailTokens: null,`

3. **Remove the `setGmailTokens` action implementation.**

4. **Update `isGmailConnected`:**
   Old: `return !!tokens && tokens.expiresAt > Date.now()`
   New: `return !!get().gmailAddress` — connection is determined by having a connected address; token validity is managed by GmailTokenContext

5. **Update `disconnectGmail`:**
   Old: calls `revokeGmailAccess(tokens.accessToken, ...)` and clears gmailTokens
   New: remove `revokeGmailAccess` call (caller will pass token separately); just `set({ gmailAddress: null, threads: [] })`
   Remove the `revokeGmailAccess` import from gmailService (if no longer used here)

6. **Update `sendEmail`:**
   Old: reads `gmailTokens` from store for the access token
   New: `sendEmail` must accept an optional `accessToken?: string` parameter so callers pass the in-memory token:
   ```typescript
   sendEmail: async (params: { to, cc, subject, body, contactId?, dealId?, companyId?, accessToken?: string }) => {
     const { accessToken } = params
     let gmailMessageId: string | undefined
     let gmailThreadId: string | undefined
     if (accessToken) {
       const sent = await sendGmailEmail({ to: params.to, cc: params.cc, subject: params.subject, body: params.body }, accessToken)
       gmailMessageId = sent.id
       gmailThreadId = sent.threadId
     }
     // rest unchanged
   }
   ```

7. **Update `loadThreads`:**
   Old: reads `gmailTokens` from store
   New: accept `accessToken: string` parameter:
   ```typescript
   loadThreads: async (accessToken: string, query = '') => {
     set({ threadsLoading: true, threadsError: null })
     try {
       if (!get().gmailAddress) {
         const profile = await getGmailProfile(accessToken)
         set({ gmailAddress: profile.emailAddress })
       }
       const threads = await listGmailThreads(accessToken, query)
       set({ threads, threadsLoading: false })
     } catch (err) {
       set({ threadsLoading: false, threadsError: err instanceof Error ? err.message : 'Error al cargar correos' })
     }
   }
   ```

8. **Update `partialize`** — remove `gmailTokens` field, keep `emails` and `gmailAddress`:
   ```typescript
   partialize: (s) => ({
     emails: s.emails,
     gmailAddress: s.gmailAddress,
   }),
   ```

9. **Bump persist version to 2** with migrate function to drop stale `gmailTokens` from existing localStorage:
   ```typescript
   {
     name: 'crm_emails',
     version: 2,
     migrate: (persistedState: unknown, version: number) => {
       if (version < 2) {
         const s = persistedState as Record<string, unknown>
         delete s.gmailTokens
         return s
       }
       return persistedState as EmailStore
     },
     partialize: (s) => ({
       emails: s.emails,
       gmailAddress: s.gmailAddress,
     }),
   }
   ```
  </action>
  <verify>
    <automated>grep -n "gmailTokens\|version.*2\|migrate\|partialize" /c/Users/david/OneDrive/Escritorio/Development/CRM/src/store/emailStore.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep "gmailTokens" src/store/emailStore.ts` returns NO matches (field fully removed from interface, state, and partialize)
    - `grep "version: 2" src/store/emailStore.ts` returns a match
    - `grep "migrate" src/store/emailStore.ts` returns a match
    - `grep "gmailAddress" src/store/emailStore.ts` returns matches (field kept)
    - `grep "accessToken" src/store/emailStore.ts` — matches only appear in the function parameter of sendEmail and loadThreads (not as a stored field)
    - `npx tsc --noEmit 2>&1 | grep "emailStore"` returns no errors
  </acceptance_criteria>
  <done>emailStore no longer stores access tokens. persist version 2 with migration strips stale gmailTokens from existing localStorage. sendEmail and loadThreads accept accessToken as a parameter from callers.</done>
</task>

</tasks>

<verification>
After all three tasks:

1. `grep "gmailTokens" src/store/emailStore.ts` — no output
2. `grep "initiateGmailOAuth" src/services/gmailService.ts` — has output
3. `grep "requestGmailAccess" src/services/gmailService.ts` — no output
4. `grep "GmailTokenProvider" src/App.tsx` — has output
5. `grep "export function useGmailToken" src/contexts/GmailTokenContext.tsx` — has output
6. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- GmailTokenContext provides accessToken in React memory only, never persisted
- emailStore partialize contains only `{ emails, gmailAddress }` — no token fields
- persist version bumped to 2; migrate() deletes legacy gmailTokens key from existing localStorage
- initiateGmailOAuth() is the sole OAuth initiation path; old initTokenClient flow is gone
- TypeScript compiles without errors across modified files
</success_criteria>

<output>
After completion, create `.planning/phases/07-gmail-integration/07-1-SUMMARY.md`
</output>
