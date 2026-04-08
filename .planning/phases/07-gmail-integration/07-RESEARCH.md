# Phase 7: Gmail Integration - Research

**Researched:** 2026-04-08
**Domain:** Google OAuth 2.0 Auth Code + PKCE, Supabase Edge Functions (Deno), Gmail REST API, React in-memory state management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a dedicated `/auth/gmail/callback` React Router route to receive the Google redirect. This is the `redirect_uri` registered in Google Cloud Console.
- **D-02:** The callback page shows a full-screen spinner with "Connecting Gmail..." while the Edge Function exchange runs (~1-2 seconds).
- **D-03:** On success → redirect to `/inbox` (threads load automatically).
- **D-04:** On failure → redirect to `/inbox` with an error toast ("Gmail connection failed — try again"). The Connect Gmail button remains visible.
- **D-05:** Replace `initTokenClient` with `initCodeClient` in `gmailService.ts`. Generate `code_verifier` (random 64-char string), `code_challenge` (SHA-256 of verifier, base64url-encoded), and `state` (random nonce). Store `code_verifier` + `state` in `sessionStorage` only (never localStorage).
- **D-06:** Redirect to Google authorization endpoint with `access_type=offline&prompt=consent` to ensure refresh token is issued on first connect.
- **D-07:** The refresh token is stored server-side only in `gmail_tokens` table. The Edge Function writes it; the browser never sees it.
- **D-08:** The access token lives in React component state only — NOT in Zustand `persist`. Remove `gmailTokens` from `emailStore`'s persist partialize. On page refresh, the app triggers a silent token refresh via Edge Function.
- **D-09:** `gmailAddress` CAN be persisted in localStorage — it's not sensitive.
- **D-10:** Silent background refresh. When any Gmail API call returns 401, automatically call `gmail-refresh-token` Edge Function, receive new access token, store in React state, retry original call.
- **D-11:** On app load, if `gmailAddress` is persisted, automatically call `gmail-refresh-token` to restore access token silently.
- **D-12:** Automatic on inbox load — match thread `from` addresses against `contacts` table by email. Store matched `contactId` in thread state. Show contact chip on matched threads.
- **D-13:** When a matched thread is opened, show a "View Contact" link navigating to `/contacts/:id`.
- **D-14:** For unmatched threads, show no chip — do not prompt to create a contact.
- **D-15:** "Send Email" on ContactDetail and DealDetail opens the existing `EmailComposer` in a SlideOver panel. Contact email and deal context pre-filled.
- **D-16:** On successful send, log the email as an activity in `activitiesStore` (type: `email`, subject from email subject, contactId/dealId pre-filled).
- **D-17:** Remove `gmailTokens: GmailTokens | null` from the persisted Zustand store.
- **D-18:** Keep `gmailAddress` in persist.
- **D-19:** Keep `emails: CRMEmail[]` in persist for sent email history.

### Claude's Discretion

- The exact React state mechanism for the in-memory access token (useState in a provider, useRef, Zustand slice without persist) — Claude decides.
- The `code_verifier` generation library (crypto.subtle vs a small utility) — Claude decides.
- Whether `gmail-oauth-exchange` and `gmail-refresh-token` are separate Deno functions or one function with `?action=` param — Claude decides (separate is cleaner).

### Deferred Ideas (OUT OF SCOPE)

- Gmail push notifications (webhooks) — real-time inbox updates without polling.
- "Create contact from email" — when an unmatched thread is viewed, offer to create a contact from the sender.
- Email tracking (open/click) — wiring tracking fields to a real tracking pixel.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GMAIL-01 | Gmail OAuth uses Auth Code + PKCE flow (`initCodeClient`) — replaces current implicit token client | GIS `initCodeClient` with `ux_mode: 'redirect'`, D-05/D-06 pattern fully documented below |
| GMAIL-02 | Edge Function `gmail-oauth-exchange` exchanges authorization code for access + refresh tokens; stores refresh token in `gmail_tokens` | Google token endpoint POST format, Deno Edge Function pattern from `invite-member` |
| GMAIL-03 | Edge Function `gmail-refresh-token` refreshes access token when expired; returns short-lived token to browser only | Google refresh grant format, JWT verification pattern from `invite-member` |
| GMAIL-04 | Inbox view loads real Gmail threads via API using short-lived access token | Existing `listGmailThreads` in `gmailService.ts` is production-ready — just needs auth wired |
| GMAIL-05 | Emails can be sent from within contact/deal detail pages | `EmailComposer` already exists with correct props; needs SlideOver wrapper on ContactDetail/DealDetail |
| GMAIL-06 | Incoming emails matched to contacts by sender email address; linked in activity feed | Contacts table has `email` column; match after `listGmailThreads` call, create activities |
| SEC-05 | Gmail access token stored in memory only (not localStorage); refresh token stored in `gmail_tokens` Supabase table | In-memory via React context/ref, Zustand partialize change documented below |
</phase_requirements>

---

## Summary

This phase wires together three moving parts that are all partially built: (1) the PKCE OAuth initiation on the client side, replacing the existing implicit `initTokenClient` in `gmailService.ts`; (2) two Supabase Edge Functions that act as the secure backend for code exchange and token refresh; and (3) the existing inbox UI and REST API wrappers in `gmailService.ts`, which are production-ready and need only the auth layer replaced.

The highest-risk area is the PKCE flow itself. Google's GIS library (`google.accounts.oauth2.initCodeClient`) with `ux_mode: 'redirect'` does **not** natively handle PKCE — the library sends the user to Google's authorization URL, but PKCE parameters (`code_challenge`, `code_challenge_method`) must be appended manually to the authorization URL or handled by constructing the URL directly (bypassing GIS entirely and using `window.location.href` with a manually built authorization URL). This is the cleaner approach for `ux_mode: redirect` with PKCE.

The second important finding: `gmail_tokens` is NOT present in the current `supabase/schema.sql` (Phase 1 left a schema plan but the table was not written to the file). Plan 7.2 must include creating this table before the Edge Function can store tokens.

**Primary recommendation:** Build the PKCE authorization URL manually (no GIS library dependency for the redirect initiation), use `crypto.subtle` for SHA-256 code challenge generation, store the access token in a React Context so all components can read it without Zustand persist, and follow the `invite-member` Edge Function pattern exactly for both new Edge Functions.

---

## Standard Stack

### Core

| Library / API | Version | Purpose | Why Standard |
|---|---|---|---|
| Google Identity Services (GIS) | Latest CDN | `initCodeClient` for popup mode; or bypass for redirect mode | Official Google OAuth library for browser |
| Google OAuth token endpoint | `https://oauth2.googleapis.com/token` | Exchange code for tokens; refresh access token | Official Google endpoint |
| Gmail REST API | v1 | Read threads, send email, get profile | Already used in `gmailService.ts` |
| `crypto.subtle` (Web Crypto API) | Browser built-in | SHA-256 for code_challenge; random bytes for verifier | Built into all modern browsers and Deno — no dependency needed |
| Supabase Edge Functions (Deno) | Deno (latest) | `gmail-oauth-exchange`, `gmail-refresh-token` | Already established pattern in `invite-member` |
| `@supabase/supabase-js` | 2.x (via esm.sh) | Admin client in Edge Functions | Same as invite-member |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| React Context API | Built-in | In-memory access token storage | Provides access token to all components without Zustand persist |
| Zustand (no persist) | Current (already installed) | Could hold access token as a Zustand slice without partialize | Alternative to Context — simpler if already using Zustand |

### Recommendation: Access Token Storage

Use a **React Context** (`GmailTokenContext`) with a `useReducer` or `useState` to hold `{ accessToken: string | null, expiresAt: number | null }`. Provide it at the App root. This avoids all Zustand persist machinery and makes the "never persisted" contract explicit.

**Installation:** No new npm packages needed. All required libraries are already installed or built into the browser/Deno runtime.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── contexts/
│   └── GmailTokenContext.tsx      # In-memory access token provider
├── pages/
│   └── GmailCallback.tsx          # /auth/gmail/callback — spinner + code exchange
supabase/functions/
├── gmail-oauth-exchange/
│   └── index.ts                   # Exchanges code + verifier for tokens
└── gmail-refresh-token/
    └── index.ts                   # Refreshes access token using stored refresh token
```

### Pattern 1: PKCE Authorization URL Construction (Manual, No GIS for Redirect)

**What:** Manually construct the Google authorization URL with PKCE parameters and redirect the browser. GIS `initCodeClient` with `ux_mode: 'redirect'` does not accept `code_challenge` parameters — the library omits them. For PKCE + redirect, build the URL directly.

**When to use:** Always — for the initiation step in `gmailService.ts`.

**Example:**
```typescript
// In gmailService.ts — replaces requestGmailAccess + initTokenClient
export async function initiateGmailOAuth(clientId: string): Promise<void> {
  // 1. Generate code_verifier: 64 random bytes, base64url-encoded
  const array = new Uint8Array(64)
  crypto.getRandomValues(array)
  const verifier = base64urlEncode(array)

  // 2. Generate code_challenge: SHA-256(verifier), base64url-encoded
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const challenge = base64urlEncode(new Uint8Array(digest))

  // 3. Generate state nonce
  const stateArray = new Uint8Array(16)
  crypto.getRandomValues(stateArray)
  const state = base64urlEncode(stateArray)

  // 4. Persist verifier + state in sessionStorage (survives redirect)
  sessionStorage.setItem('gmail_oauth_state', state)
  sessionStorage.setItem('gmail_code_verifier', verifier)

  // 5. Build authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/gmail/callback`,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

function base64urlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
```

**Confidence:** HIGH — `crypto.subtle.digest('SHA-256', ...)` is standard Web Crypto API, available in all modern browsers and Deno.

### Pattern 2: Gmail Callback Page

**What:** A React route at `/auth/gmail/callback` that reads the `code` and `state` URL params, verifies state, calls the Edge Function, stores the returned access token in React context, then navigates to `/inbox`.

**Example:**
```typescript
// src/pages/GmailCallback.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from '../store/toastStore'
import { supabase } from '../lib/supabase'
import { useGmailToken } from '../contexts/GmailTokenContext'

export function GmailCallback() {
  const navigate = useNavigate()
  const { setToken } = useGmailToken()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const returnedState = params.get('state')
    const storedState = sessionStorage.getItem('gmail_oauth_state')
    const verifier = sessionStorage.getItem('gmail_code_verifier')

    sessionStorage.removeItem('gmail_oauth_state')
    sessionStorage.removeItem('gmail_code_verifier')

    if (!code || returnedState !== storedState || !verifier) {
      toast.error('Gmail connection failed — try again')
      navigate('/inbox')
      return
    }

    supabase.functions.invoke('gmail-oauth-exchange', {
      body: { code, code_verifier: verifier },
    }).then(({ data, error }) => {
      if (error || !data?.access_token) {
        toast.error('Gmail connection failed — try again')
        navigate('/inbox')
        return
      }
      setToken({ accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 })
      // gmailAddress update handled by emailStore.setGmailAddress (non-sensitive, can persist)
      navigate('/inbox')
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-navy-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={32} className="animate-spin text-brand-400" />
        <p className="text-slate-400 text-sm">Connecting Gmail...</p>
      </div>
    </div>
  )
}
```

### Pattern 3: Edge Function — gmail-oauth-exchange

**What:** Receives `{ code, code_verifier }` from the SPA, POSTs to Google token endpoint, upserts the refresh token into `gmail_tokens`, returns only `{ access_token, expires_in }` to the browser.

**Key requirement:** Requires the Supabase user JWT in the Authorization header (like `invite-member`) to identify which user row to write.

```typescript
// supabase/functions/gmail-oauth-exchange/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { code, code_verifier } = await req.json()

    // Verify caller has a valid Supabase session
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user }, error: userErr } = await callerClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Exchange code for tokens at Google
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: Deno.env.get('APP_URL')! + '/auth/gmail/callback',
        grant_type: 'authorization_code',
        code_verifier,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.json()
      return new Response(JSON.stringify({ error: err.error_description ?? 'Token exchange failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { access_token, refresh_token, expires_in, scope } = await tokenRes.json()

    // Get email address from Google
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    const { emailAddress } = await profileRes.json()

    // Upsert refresh token into gmail_tokens (admin client for write access)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    await adminClient.from('gmail_tokens').upsert({
      user_id: user.id,
      refresh_token,
      access_token,  // store latest for debugging only — browser gets fresh token each time
      token_expiry: new Date(Date.now() + expires_in * 1000).toISOString(),
      email_address: emailAddress,
      scope,
    }, { onConflict: 'user_id' })

    // Return ONLY the short-lived access token to the browser
    return new Response(
      JSON.stringify({ access_token, expires_in, email_address: emailAddress }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
```

### Pattern 4: Edge Function — gmail-refresh-token

**What:** Looks up the stored refresh token for the authenticated user, POSTs to Google token refresh endpoint, returns a new `access_token` only.

```typescript
// supabase/functions/gmail-refresh-token/index.ts
// ... same CORS + callerClient pattern as above ...

// Look up refresh token for this user
const { data: tokenRow } = await adminClient
  .from('gmail_tokens')
  .select('refresh_token, email_address')
  .eq('user_id', user.id)
  .single()

if (!tokenRow?.refresh_token) {
  return new Response(JSON.stringify({ error: 'No refresh token stored' }), { status: 404, ... })
}

const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
    client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
    refresh_token: tokenRow.refresh_token,
    grant_type: 'refresh_token',
  }),
})

const { access_token, expires_in } = await refreshRes.json()
return new Response(
  JSON.stringify({ access_token, expires_in, email_address: tokenRow.email_address }),
  { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)
```

### Pattern 5: GmailToken React Context (In-Memory Access Token)

**What:** A React Context that holds the access token in memory. Never written to localStorage. Provides `accessToken`, `setToken`, `clearToken`. Placed at App root.

```typescript
// src/contexts/GmailTokenContext.tsx
import { createContext, useContext, useState } from 'react'

interface GmailTokenState {
  accessToken: string | null
  expiresAt: number | null
}

interface GmailTokenContextValue extends GmailTokenState {
  setToken: (state: GmailTokenState) => void
  clearToken: () => void
  isTokenValid: () => boolean
}

const GmailTokenContext = createContext<GmailTokenContextValue | null>(null)

export function GmailTokenProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GmailTokenState>({ accessToken: null, expiresAt: null })

  return (
    <GmailTokenContext.Provider value={{
      ...state,
      setToken: setState,
      clearToken: () => setState({ accessToken: null, expiresAt: null }),
      isTokenValid: () => !!state.accessToken && (state.expiresAt ?? 0) > Date.now(),
    }}>
      {children}
    </GmailTokenContext.Provider>
  )
}

export function useGmailToken() {
  const ctx = useContext(GmailTokenContext)
  if (!ctx) throw new Error('useGmailToken must be used within GmailTokenProvider')
  return ctx
}
```

### Pattern 6: Contact Linking After Thread Load

**What:** After `listGmailThreads` returns, extract the `from` field of each thread's last message, parse out the email address, query the in-memory contacts array (already loaded by `contactsStore`), and attach `contactId` to the thread state.

```typescript
// In emailStore.loadThreads (or a utility function)
import { useContactsStore } from './contactsStore'

function extractEmail(from: string): string {
  // "John Doe <john@example.com>" → "john@example.com"
  const match = from.match(/<(.+?)>/)
  return match ? match[1].toLowerCase() : from.toLowerCase().trim()
}

// After threads = await listGmailThreads(accessToken, query)
const contacts = useContactsStore.getState().contacts
const threadsWithLinks = threads.map(thread => {
  const lastMsg = thread.messages[thread.messages.length - 1]
  const senderEmail = lastMsg ? extractEmail(lastMsg.from) : null
  const contact = senderEmail ? contacts.find(c => c.email?.toLowerCase() === senderEmail) : null
  return { ...thread, contactId: contact?.id ?? null }
})
```

**Note:** `GmailThread` type needs a `contactId?: string | null` field added.

### Pattern 7: Activity Logging on Email Send (D-16)

```typescript
// After sendGmailEmail succeeds in emailStore.sendEmail
import { useActivitiesStore } from './activitiesStore'

useActivitiesStore.getState().addActivity({
  type: 'email',
  subject: params.subject,
  description: `Email sent to ${params.to.join(', ')}`,
  status: 'completed',
  contactId: params.contactId,
  dealId: params.dealId,
  completedAt: new Date().toISOString(),
})
```

### Anti-Patterns to Avoid

- **Storing access token in Zustand `persist`:** Violates SEC-05. The `partialize` function in `emailStore` must NOT include `gmailTokens`. Remove it.
- **Storing access token in `sessionStorage` or `localStorage`:** Even sessionStorage is not "memory only." React context state is the correct choice.
- **Using `initTokenClient` (implicit flow):** Cannot obtain refresh tokens. Must use `initCodeClient` or direct authorization URL construction.
- **Sending `GOOGLE_CLIENT_SECRET` to the browser:** Never VITE_-prefix it. It lives only in Edge Function env vars.
- **Calling Google token endpoint directly from the browser:** Exposes client secret. Always go through the Edge Function.
- **Missing `prompt=consent` on first connect:** Without it, Google does not issue a refresh token on subsequent authorizations.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SHA-256 hashing for code_challenge | Custom hash utility | `crypto.subtle.digest('SHA-256', ...)` | Built into all modern browsers and Deno — zero dependency |
| MIME message encoding for Gmail send | Custom MIME builder | Already built in `gmailService.ts` (`buildMimeMessage`) | Handles encoding, line endings, base64url — do not rewrite |
| JWT verification in Edge Functions | Manual JWT decode | `callerClient.auth.getUser()` pattern (as in invite-member) | Supabase handles signature verification and expiry |
| Email address extraction from RFC 5322 `From:` header | Complex regex | Simple `/<(.+?)>/` regex or `from.match(/<(.+?)>/)` | RFC 5322 is complex but 99% of Gmail `From:` headers follow `"Name <email>"` or bare `"email"` format |

**Key insight:** The Gmail REST API wrapper in `gmailService.ts` is production-ready. The only code that needs replacement is the auth initiation (`requestGmailAccess`). Do not touch `sendGmailEmail`, `listGmailThreads`, `getGmailThread`, `getGmailProfile`, or the MIME builder.

---

## Critical Discovery: gmail_tokens Table Missing from schema.sql

**Finding:** The `gmail_tokens` table is referenced in Phase 1 plan (1.3) and REQUIREMENTS (SCHEMA-05) but is NOT present in the current `supabase/schema.sql`. The Phase 1 plans were completed but this table was not written to the schema file.

**Required SQL (must be created in Plan 7.2 before the Edge Function can run):**
```sql
create table if not exists public.gmail_tokens (
  id            uuid primary key default uuid_generate_v4(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  email_address text,
  access_token  text,           -- latest short-lived token (stored for debugging, not sent to browser)
  refresh_token text not null,  -- long-lived; browser never sees this
  token_expiry  timestamptz,
  scope         text,
  constraint gmail_tokens_user_id_key unique (user_id)  -- one row per user
);

-- RLS: user can only read/write their own row
alter table public.gmail_tokens enable row level security;

create policy "User can manage own gmail token"
  on public.gmail_tokens
  for all
  using (auth.uid() = user_id);
```

**The Edge Function uses the service role key to write**, so RLS doesn't block it. The RLS policy above prevents cross-user reads via the anon client.

---

## Environment Variables

| Variable | Location | Purpose | Prefix |
|---|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` + Vercel | Sent to browser for OAuth initiation | `VITE_` (safe — client ID is public) |
| `GOOGLE_CLIENT_ID` | Supabase Edge Function secrets | Edge Function token exchange | No prefix — server-only |
| `GOOGLE_CLIENT_SECRET` | Supabase Edge Function secrets | Edge Function token exchange | No prefix — NEVER expose to browser |
| `APP_URL` | Supabase Edge Function secrets | Constructs `redirect_uri` for token exchange | No prefix — e.g., `https://yourapp.vercel.app` |
| `SUPABASE_URL` | Auto-injected in Edge Functions | Supabase client | Auto-injected by Supabase |
| `SUPABASE_ANON_KEY` | Auto-injected in Edge Functions | Caller JWT verification | Auto-injected by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected in Edge Functions | Admin DB writes | Auto-injected by Supabase |

**Critical:** `GOOGLE_CLIENT_SECRET` must NEVER have a `VITE_` prefix. As noted in STATE.md: "Supabase service role key must NEVER get a VITE_ prefix" — same rule applies here.

**Note on `redirect_uri` consistency:** The `redirect_uri` in the browser's OAuth initiation call AND in the Edge Function's token exchange call must be identical. Recommended: hardcode `${APP_URL}/auth/gmail/callback` in both places and set `APP_URL` in Edge Function env.

---

## Google Cloud Console Setup (Required Before Testing)

1. Create / select a project in Google Cloud Console.
2. Enable the **Gmail API** under APIs & Services > Library.
3. Configure OAuth consent screen:
   - User Type: External (for testing; Internal if Google Workspace org)
   - Add scopes: `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.compose`
   - Add test users during development (required for External + Testing status)
4. Create OAuth 2.0 credentials: Application type = **Web application**
5. Authorized redirect URIs:
   - `http://localhost:5173/auth/gmail/callback` (development)
   - `https://yourapp.vercel.app/auth/gmail/callback` (production)
6. Copy Client ID → `VITE_GOOGLE_CLIENT_ID` and `.env.local`
7. Copy Client Secret → Supabase Edge Function secret `GOOGLE_CLIENT_SECRET`

**Important note from STATE.md:** "Google OAuth verification (restricted scopes) takes 4-6 weeks — start application early." The Gmail scopes used here (`gmail.send`, `gmail.readonly`) are classified as **restricted scopes** by Google. During development, the app will work for registered test users. For production with real users, Google verification is required.

---

## emailStore Changes Required

Current `emailStore.ts` persist partialize:
```typescript
// CURRENT (must change):
partialize: (s) => ({
  emails: s.emails,
  gmailTokens: s.gmailTokens,  // <-- REMOVE: violates SEC-05
  gmailAddress: s.gmailAddress,
}),
```

New partialize (D-17, D-18, D-19):
```typescript
// AFTER (correct):
partialize: (s) => ({
  emails: s.emails,
  gmailAddress: s.gmailAddress,  // non-sensitive, ok to persist
}),
```

The `gmailTokens` field and `setGmailTokens` action can be removed from the store interface entirely. `isGmailConnected()` should now read from the `GmailTokenContext` (via a passed-in getter) or be replaced by `useGmailToken().isTokenValid()`.

The `loadThreads` and `sendEmail` actions must be updated to accept `accessToken` as a parameter rather than reading it from store state.

---

## Common Pitfalls

### Pitfall 1: state Nonce Mismatch
**What goes wrong:** The callback receives a `state` param that doesn't match `sessionStorage.getItem('gmail_oauth_state')`, and the exchange is silently skipped or causes an infinite redirect.
**Why it happens:** sessionStorage is tab-scoped — opening the OAuth redirect in a new tab clears the stored state for the original tab.
**How to avoid:** Never open the redirect in a new tab. Use `window.location.href =` (same-tab redirect). The callback must run in the same tab that initiated the flow.
**Warning signs:** `state` param in callback URL exists but sessionStorage returns null.

### Pitfall 2: redirect_uri Mismatch Between Authorization Request and Token Exchange
**What goes wrong:** Google returns `redirect_uri_mismatch` error from the token endpoint, even though the callback route works.
**Why it happens:** The `redirect_uri` in the browser's authorization URL and the `redirect_uri` in the Edge Function's token exchange POST must be byte-for-byte identical. If the browser sends `http://localhost:5173/auth/gmail/callback` but the Edge Function sends `http://localhost:5173/auth/gmail/callback/` (trailing slash), Google rejects it.
**How to avoid:** Derive `redirect_uri` from a single source of truth. Set `APP_URL` in Edge Function env (e.g., `http://localhost:5173` for local dev). Both sides append `/auth/gmail/callback` from the same string.
**Warning signs:** Edge Function returns 400 with `redirect_uri_mismatch` in the error body.

### Pitfall 3: No Refresh Token Issued (Missing prompt=consent)
**What goes wrong:** Google's token endpoint response contains `access_token` but no `refresh_token`. The Edge Function upserts a row with `refresh_token = null`, and subsequent silent refresh calls fail.
**Why it happens:** Google only issues a refresh token on the first authorization OR when `prompt=consent` is explicitly set. If the user previously authorized the app (even with the old implicit flow), Google will not re-issue a refresh token without `prompt=consent`.
**How to avoid:** Always include `prompt=consent` in the authorization URL (D-06). Already locked in decisions.
**Warning signs:** `gmail_tokens.refresh_token` is null after a successful exchange.

### Pitfall 4: Access Token in Zustand persist After Removal
**What goes wrong:** Old `crm_emails` localStorage entry from before the migration still contains `gmailTokens`. User refreshes the page and Zustand rehydrates the old persisted value.
**Why it happens:** Zustand `persist` rehydrates from whatever is stored under the key. Removing a field from `partialize` doesn't clear existing localStorage data.
**How to avoid:** In `emailStore`, add a `version: 2` to the persist config and a `migrate` function that strips `gmailTokens` from v1 state. Or simply clear the key on first load if it contains `gmailTokens`.
**Warning signs:** After deploying, `localStorage.getItem('crm_emails')` still shows `gmailTokens` for existing users.

### Pitfall 5: Silent Refresh Race Condition
**What goes wrong:** Two simultaneous Gmail API calls both hit 401, both trigger `gmail-refresh-token`, one succeeds and updates state, the other overwrites with a potentially different token.
**Why it happens:** No refresh lock/mutex around the refresh call.
**How to avoid:** Implement a simple in-flight flag in the GmailTokenContext: `isRefreshing: boolean`. If `isRefreshing` is true, queue the retry instead of firing another refresh. For v1 with minimal traffic, an `isRefreshing` ref is sufficient — no need for a full queue.

### Pitfall 6: GIS Library Not Loaded
**What goes wrong:** `window.google.accounts.oauth2` is undefined when `initiateGmailOAuth` is called. Error surfaces to user as uncaught exception.
**Why it happens:** The GIS script (`https://accounts.google.com/gsi/client`) may not have loaded yet, or is blocked by an ad blocker.
**How to avoid:** The existing `isGISLoaded()` check in `gmailService.ts` handles this. However, for the manual redirect approach (bypassing GIS for initiation), the GIS library is not needed at all — the only dependency is `window.location.href` and `crypto.subtle`. **Recommended: remove the GIS library dependency from the initiation path entirely.** Only keep the GIS revoke call for `disconnectGmail`.

---

## Code Examples

### base64url encode utility (used for both code_verifier and code_challenge)
```typescript
// Source: RFC 7636 + Web Crypto API standard
function base64urlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
```

### Google token endpoint — exchange authorization code
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code=<auth_code>
&client_id=<GOOGLE_CLIENT_ID>
&client_secret=<GOOGLE_CLIENT_SECRET>
&redirect_uri=<exact_same_redirect_uri_used_in_authz_request>
&grant_type=authorization_code
&code_verifier=<original_verifier>
```

Response includes: `access_token`, `expires_in` (seconds, typically 3600), `refresh_token`, `token_type: "Bearer"`, `scope`.

### Google token endpoint — refresh access token
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id=<GOOGLE_CLIENT_ID>
&client_secret=<GOOGLE_CLIENT_SECRET>
&refresh_token=<stored_refresh_token>
&grant_type=refresh_token
```

Response includes: `access_token`, `expires_in`, `token_type`. Does NOT return a new refresh token.

### Supabase Edge Function invocation from SPA (browser side)
```typescript
// Source: existing invite-member pattern in codebase
const { data, error } = await supabase.functions.invoke('gmail-oauth-exchange', {
  body: { code, code_verifier: verifier },
})
// supabase.functions.invoke automatically attaches the user's JWT in Authorization header
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `initTokenClient` (implicit flow) | `initCodeClient` + Auth Code + PKCE | GIS library migration guide (2022+) | Implicit flow deprecated; cannot get refresh tokens |
| Storing tokens in localStorage | In-memory (React state) for access token; server-side for refresh | Security best practice evolution | Eliminates XSS token theft |
| Client secret in browser SPA | Edge Function proxy; secret stays server-side | Standard SPA security practice | SPAs cannot securely store secrets |

**Deprecated/outdated:**
- `window.google.accounts.oauth2.initTokenClient`: Cannot issue refresh tokens — use `initCodeClient` or direct URL construction.
- Implicit OAuth flow (`response_type=token`): Deprecated by Google. Use authorization code flow.

---

## Open Questions

1. **gmail_tokens table: was it applied to the live Supabase project?**
   - What we know: It's not in `schema.sql` (the source of truth file). Phase 1 marked complete but the SQL was not written to the file.
   - What's unclear: Whether the Supabase project has the table applied via Supabase dashboard manually.
   - Recommendation: Plan 7.2 should include the SQL migration unconditionally using `create table if not exists` — safe to run whether or not the table exists.

2. **organization_id on gmail_tokens: required for RLS?**
   - What we know: All other tables use `organization_id` for multi-tenancy RLS. Gmail tokens are personal (per-user), not per-org.
   - What's unclear: Whether the RLS policy should also enforce `organization_id` or just `user_id`.
   - Recommendation: Use `user_id` only for RLS on `gmail_tokens`. A user's Gmail connection is personal, not shared with their org. Include `organization_id` column for audit/analytics but base RLS on `user_id`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js / npm | Build tooling | ✓ | (project already building) | — |
| Supabase CLI | Edge Function deployment | Unknown — not checked | — | Deploy via Supabase dashboard |
| Google Cloud Console account | OAuth credentials | Must be set up manually | — | None — blocks testing |
| `crypto.subtle` | PKCE code_challenge | ✓ | Built into all modern browsers | — |

**Missing dependencies with no fallback:**
- Google Cloud Console project with Gmail API enabled and OAuth credentials — must be created before Plan 7.1 can be tested end-to-end.

**Missing dependencies with fallback:**
- Supabase CLI: Edge Functions can be deployed via Supabase dashboard UI if CLI is not installed locally.

---

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest (configured in Phase 9 — not yet installed) |
| Config file | None — Phase 9 |
| Quick run command | `npm run test:run` (Phase 9) |
| Full suite command | `npm run test:run` (Phase 9) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| GMAIL-01 | `initiateGmailOAuth` generates correct code_verifier, code_challenge, state, and constructs the correct authorization URL | unit | Phase 9 | ❌ Wave 0 |
| GMAIL-02 | Edge Function exchanges code + verifier for tokens and upserts to gmail_tokens | manual smoke | n/a — Edge Function | ❌ manual |
| GMAIL-03 | Edge Function returns new access_token given valid refresh_token | manual smoke | n/a — Edge Function | ❌ manual |
| GMAIL-04 | Inbox loads real Gmail threads after auth | manual smoke | n/a — requires Gmail account | ❌ manual |
| GMAIL-05 | Send from ContactDetail logs an activity | manual smoke | n/a — requires Gmail | ❌ manual |
| GMAIL-06 | Contact linking matches sender email to contacts table | unit | Phase 9 — `extractEmail` + contact match logic | ❌ Wave 0 |
| SEC-05 | `localStorage.getItem('crm_emails')` contains no `accessToken` field | manual DevTools check | manual | — |

### Sampling Rate
- **Per task commit:** Manual smoke test of the specific feature (e.g., after Plan 7.1: verify OAuth redirect initiates correctly in browser)
- **Per wave merge:** Full manual walkthrough of connect → inbox → send → disconnect flow
- **Phase gate:** All "Done When" criteria in ROADMAP Phase 7 verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/utils/gmailUtils.test.ts` — unit tests for `extractEmail()` and contact matching (REQ GMAIL-06)
- [ ] `src/services/gmailService.test.ts` — unit tests for `base64urlEncode`, PKCE URL construction (REQ GMAIL-01)
- [ ] Vitest not yet installed (Phase 9) — manual testing required for Phase 7

---

## Sources

### Primary (HIGH confidence)
- [Google Identity Services — Use Code Model](https://developers.google.com/identity/oauth2/web/guides/use-code-model) — initCodeClient, ux_mode, redirect_uri requirements
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) — token endpoint POST format, refresh grant format
- `supabase/functions/invite-member/index.ts` — Deno Edge Function pattern (direct codebase read)
- `src/services/gmailService.ts` — Existing REST wrapper (direct codebase read)
- `src/store/emailStore.ts` — Current persist partialize to change (direct codebase read)
- [Web Crypto API — SubtleCrypto.digest()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest) — SHA-256 for code_challenge (built-in standard)

### Secondary (MEDIUM confidence)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions) — Deno runtime, env var injection
- [Supabase Edge Functions Auth](https://supabase.com/docs/guides/functions/auth) — JWT verification in Edge Functions

### Tertiary (LOW confidence)
- [Google OIDC Code Flow with PKCE blog post](https://www.codegenes.net/blog/using-google-oidc-with-code-flow-and-pkce/) — PKCE for SPAs with Google; cross-verify with official docs before implementing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — GIS library and Google token endpoint are official and stable
- Architecture: HIGH — Patterns derived from existing codebase (`invite-member`) and official Google docs
- Pitfalls: HIGH — State nonce, redirect_uri mismatch, and missing refresh token are well-documented gotchas from official Google OAuth docs
- gmail_tokens schema: HIGH — Direct file inspection confirmed the table is absent from schema.sql

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (Google OAuth APIs are stable; GIS library versioning is not pinned to a version)
