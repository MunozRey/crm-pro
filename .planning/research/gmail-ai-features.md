# Gmail OAuth2 + AI Features Research

**Project:** CRM Pro
**Researched:** 2026-03-31
**Scope:** Gmail OAuth2 PKCE, secure token storage, thread-to-CRM linking, Anthropic Claude AI features, Supabase Edge Function proxy, XSS prevention
**Confidence:** HIGH (based on official API documentation knowledge; web tools unavailable in this session)

---

## Codebase Audit: What Already Exists and What Is Broken

Before recommendations, a clear-eyed audit of the current state is necessary. Several patterns in the existing code are
directly relevant to the implementation decisions below.

### Current Gmail Implementation (gmailService.ts + emailStore.ts)

The existing code uses **Google Identity Services (GIS) Token Client** (`window.google.accounts.oauth2.initTokenClient`).
This is the **implicit-grant-like** flow — it returns only a short-lived `access_token` (1 hour), never a `refresh_token`.

Problems with this approach:
- No refresh token means the user must re-authorize every hour. Tokens cannot be silently renewed.
- The access token is returned directly to the browser JavaScript, where it lives in Zustand `persist` → localStorage.
  Any XSS attack can steal it.
- `GmailTokens` type only has `{ accessToken: string; expiresAt: number }` — there is nowhere to store a refresh token
  even if one were obtained.
- `isGmailConnected()` checks `tokens.expiresAt > Date.now()`. After expiry, the user sees a disconnected state with
  no automatic recovery.

### Current AI Implementation (aiService.ts + aiStore.ts)

- Anthropic SDK is initialized with `dangerouslyAllowBrowser: true` — the API key hits the Anthropic API directly from
  the browser.
- `apiKey` is stored in Zustand `persist` → localStorage under key `crm_ai`. Any XSS can read it.
- `openRouterKey` has the same problem.
- OpenRouter calls are also made directly from the browser with the key in the Authorization header.

### Current XSS Vector (AIAgent.tsx)

```tsx
// Line 14-23: hand-rolled markdown renderer
function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // ...
}

// Line 315: dangerouslySetInnerHTML with unsanitized AI output
dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
```

This is a live XSS vector. If the Anthropic API response ever contains `<script>` tags (prompt injection, supply chain
issue, or jailbreak), they execute in the user's browser. The regex replacements do not strip or escape HTML — they only
add new tags, leaving existing HTML in the AI output intact.

---

## 1. Gmail OAuth2 PKCE Flow in a Vite SPA

### The Core Problem: Token Client vs. Auth Code Model

Google offers two GIS flows for web apps:

| Flow | GIS Method | Returns | Refresh Token | Suitable For |
|------|-----------|---------|--------------|-------------|
| Token Client (implicit-like) | `initTokenClient` | `access_token` only | Never | Frontend-only, short sessions |
| Auth Code + PKCE | `initCodeClient` | `code` (one-time) | Yes (server-side) | Production SaaS with persistent access |

**The current implementation uses Token Client. Production Gmail integration requires the Auth Code + PKCE model.**

### Recommended Approach: Auth Code + PKCE via `initCodeClient`

**Why Auth Code + PKCE over Token Client:**
- Yields a `refresh_token` that can be stored server-side and used to get new `access_token`s silently forever.
- The `access_token` never needs to be stored persistently — derive it fresh from the refresh token when needed.
- Meets Google's OAuth security requirements for apps requesting sensitive scopes like Gmail.
- Required for Google Workspace domain-wide delegation scenarios.

**Why redirect over popup:**

Popups are blocked by default in most modern browsers unless triggered directly in a user gesture handler. For a Vite
SPA deployed to Vercel, the redirect model is simpler and more reliable:

- Single `redirect_uri` registered in Google Cloud Console pointing to `/auth/gmail/callback`.
- After the user grants permission, Google redirects back with `?code=xxx&state=yyy`.
- The SPA reads the `code` from the URL, sends it to a Supabase Edge Function for token exchange.
- The Edge Function trades the `code` for tokens, stores the `refresh_token` in Supabase, and returns only the
  short-lived `access_token` to the client.

**PKCE flow steps for a Vite SPA:**

```
1. Client generates:
   - code_verifier: 43-128 char random string (crypto.getRandomValues)
   - code_challenge: BASE64URL(SHA-256(code_verifier))
   - state: random string to prevent CSRF

2. Store code_verifier + state in sessionStorage (NOT localStorage)

3. Redirect to Google authorization endpoint:
   https://accounts.google.com/o/oauth2/v2/auth
     ?client_id=YOUR_CLIENT_ID
     &redirect_uri=https://yourdomain.com/auth/gmail/callback
     &response_type=code
     &scope=https://www.googleapis.com/auth/gmail.send
            https://www.googleapis.com/auth/gmail.readonly
            https://www.googleapis.com/auth/gmail.modify
     &access_type=offline          ← required for refresh_token
     &prompt=consent               ← required to get refresh_token on re-auth
     &code_challenge=BASE64URL(SHA-256(verifier))
     &code_challenge_method=S256
     &state=RANDOM_STATE

4. Google redirects back to /auth/gmail/callback?code=AUTH_CODE&state=STATE

5. SPA:
   a. Verifies state matches sessionStorage value (CSRF check)
   b. Reads code_verifier from sessionStorage
   c. POSTs { code, code_verifier } to Supabase Edge Function /functions/v1/gmail-oauth-exchange

6. Edge Function (runs server-side):
   a. Exchanges code + code_verifier for tokens via Google token endpoint
   b. Receives { access_token, refresh_token, expires_in }
   c. Stores refresh_token encrypted in Supabase (user-scoped row)
   d. Returns { access_token, expires_at } to client (NOT the refresh_token)

7. Client stores only { access_token, expires_at } in memory (Zustand, no persist)
```

**Critically:** `access_type=offline` and `prompt=consent` must both be set. Without `prompt=consent`, Google only
returns a `refresh_token` on the first authorization. If the user re-authorizes (e.g., after token revocation), they
won't get a new refresh token unless `prompt=consent` forces the consent screen again.

### Required Scopes

| Scope | Purpose | Sensitivity Level |
|-------|---------|------------------|
| `https://www.googleapis.com/auth/gmail.readonly` | Read emails and threads | Restricted |
| `https://www.googleapis.com/auth/gmail.send` | Send email on behalf of user | Restricted |
| `https://www.googleapis.com/auth/gmail.modify` | Mark read, apply labels, archive | Restricted |
| `https://www.googleapis.com/auth/userinfo.email` | Get user's email address | Basic |

**Important:** `gmail.readonly`, `gmail.send`, and `gmail.modify` are all **restricted scopes** per Google's OAuth
policy. Apps requesting them must pass a **Google OAuth verification** process before they can be used by more than
100 test users. Plan for 4-6 weeks for the security review if targeting production launch.

The `gmail.compose` scope in the current code is a subset of `gmail.modify`. Drop it — use `gmail.modify` which is
a superset and also allows thread labeling and read status.

### GIS `initCodeClient` vs. Manual PKCE

Google's GIS library provides `google.accounts.oauth2.initCodeClient` which handles the redirect and returns the
`code` to a callback. This is simpler than building the full authorization URL manually. However, GIS's `initCodeClient`
does **not** implement PKCE automatically — you must generate and pass `code_challenge` and `code_challenge_method`
as additional parameters.

Alternative: Build the authorization URL manually (no GIS dependency at all). This is cleaner for a production app
because it removes the GIS script tag dependency and gives full control. The GIS library was primarily designed for
Google Sign-In use cases, not raw OAuth flows.

**Recommendation: Build the authorization URL manually.** Remove the GIS script tag and the `window.google` global
entirely. The existing `gmailService.ts` already builds direct REST calls to the Gmail API — extend that pattern to
also build the OAuth URL manually.

---

## 2. Storing Gmail Refresh Tokens Securely via Supabase Edge Functions

### Why the Current Approach Is Insecure

`GmailTokens` is stored via `zustand/persist` → localStorage. On any XSS attack, the access token is immediately
readable. While access tokens expire in 1 hour, that window is more than sufficient for an attacker to send emails,
read the inbox, and exfiltrate data.

### Correct Architecture: Supabase as OAuth Proxy

```
Browser                 Supabase Edge Functions         Supabase DB (postgres)
  │                              │                              │
  │  POST /gmail-oauth-exchange  │                              │
  │  { code, code_verifier }     │                              │
  │─────────────────────────────>│                              │
  │                              │  POST tokens.google.com      │
  │                              │─────────────────────────────>│
  │                              │  { access_token,             │
  │                              │    refresh_token,            │
  │                              │    expires_in }              │
  │                              │<─────────────────────────────│
  │                              │                              │
  │                              │  INSERT INTO gmail_tokens    │
  │                              │  (user_id, refresh_token,    │
  │                              │   access_token, expires_at)  │
  │                              │─────────────────────────────>│
  │                              │                              │
  │  { access_token, expires_at }│                              │
  │<─────────────────────────────│                              │
```

The `refresh_token` never leaves the server side. The browser only ever receives a short-lived `access_token`.

### Database Table for Token Storage

```sql
create table public.gmail_tokens (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  email_address text not null,
  -- Store encrypted. Use pgcrypto or Vault.
  refresh_token text not null,
  access_token  text,
  expires_at    timestamptz,
  scopes        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint gmail_tokens_user_unique unique (user_id)
);

alter table public.gmail_tokens enable row level security;

-- Users can only read/write their own token row
create policy "users_own_gmail_tokens" on public.gmail_tokens
  for all using (auth.uid() = user_id);
```

**Encryption:** Supabase does not encrypt column values at rest by default (the entire disk is encrypted, but individual
column values are stored in plaintext in postgres). For a refresh token, use one of:

1. **Supabase Vault** (built-in secrets manager, available on all plans): Store the refresh token via
   `vault.create_secret()`. Reference the secret ID in your table, not the value itself. Retrieve it only inside
   Edge Functions.
2. **pgcrypto `pgp_sym_encrypt`**: Encrypt with a key stored in a Supabase secret (env var). Simpler but less elegant.

For v1.0, `pgcrypto` is acceptable. Vault is the better long-term answer.

### Token Refresh Pattern

When the client needs to call the Gmail API:

```
1. Client checks if access_token is still valid (expires_at > now + 60s buffer)
2. If valid: use stored access_token directly
3. If expired: call Supabase Edge Function /functions/v1/gmail-refresh-token
   - Edge Function reads refresh_token from DB (user_id from JWT)
   - Calls https://oauth2.googleapis.com/token with refresh_token + client_secret
   - Updates DB row with new access_token + expires_at
   - Returns new access_token to client
4. Client stores new access_token in Zustand (no persist — memory only)
```

**Critical:** The `client_secret` must never be in the frontend. It lives only as a Supabase Edge Function
environment variable (`GOOGLE_CLIENT_SECRET`). This is why all token exchange and refresh operations must go through
Edge Functions.

### Edge Function: gmail-oauth-exchange

```typescript
// supabase/functions/gmail-oauth-exchange/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { code, code_verifier, redirect_uri } = await req.json()

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      redirect_uri,
      grant_type: "authorization_code",
    }),
  })

  const tokens = await tokenRes.json()
  if (tokens.error) {
    return new Response(JSON.stringify({ error: tokens.error }), { status: 400 })
  }

  // Get user's email address
  const profileRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const profile = await profileRes.json()

  // Store refresh token in Supabase (using service role to bypass RLS for write)
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  // Get user_id from the request JWT
  const authHeader = req.headers.get("Authorization")!
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))

  await supabase.from("gmail_tokens").upsert({
    user_id: user!.id,
    email_address: profile.emailAddress,
    refresh_token: tokens.refresh_token,  // encrypt before storing in production
    access_token: tokens.access_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope,
  })

  // Return only short-lived access_token to client
  return new Response(JSON.stringify({
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    email_address: profile.emailAddress,
  }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

**Required environment variables for Edge Functions:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL` (auto-injected by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected by Supabase)

Set via: `supabase secrets set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=yyy`

---

## 3. Linking Gmail Threads to CRM Contacts and Deals

### Matching Strategy: Email Address as Primary Key

The reliable way to link Gmail threads to CRM contacts is via email address extraction from message headers.

**From the existing `parseMessage` function in `gmailService.ts`**, the `from` and `to` headers are already extracted.
The linking logic should:

1. Extract all unique email addresses from thread messages (From, To, Cc headers).
2. Query Supabase contacts table: `SELECT id, email FROM contacts WHERE email = ANY($1)`.
3. If a match exists, associate the thread with that contact.
4. Optionally, find a related deal by: find open deals where `contact_id` matches the matched contact.

```typescript
function extractEmailAddresses(thread: GmailThread): string[] {
  const addresses = new Set<string>()
  for (const msg of thread.messages) {
    // Parse "Name <email@domain.com>" format
    const extract = (header: string) => {
      const match = header.match(/<([^>]+)>/) || header.match(/([^\s,]+@[^\s,]+)/)
      return match ? match[1].toLowerCase() : null
    }
    if (msg.from) { const e = extract(msg.from); if (e) addresses.add(e) }
    if (msg.to) { const e = extract(msg.to); if (e) addresses.add(e) }
  }
  return Array.from(addresses)
}
```

**Note:** The current `GmailMessage` type stores `from` and `to` as raw header strings which may be in
`"John Smith <john@example.com>"` format. The linking logic must handle this format, not just bare email addresses.

### Threading Model

Gmail's threading model uses `threadId` as the canonical identifier for a conversation. The existing `CRMEmail` type
already has `gmailThreadId?: string` — use this as the link.

**Recommended data model additions:**

```sql
-- Link Gmail threads to CRM entities
create table public.gmail_thread_links (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  thread_id   text not null,               -- Gmail thread ID
  contact_id  uuid references public.contacts(id) on delete set null,
  deal_id     uuid references public.deals(id) on delete set null,
  company_id  uuid references public.companies(id) on delete set null,
  linked_at   timestamptz not null default now(),
  constraint gmail_thread_user_unique unique (user_id, thread_id)
);
```

This table is updated:
- Automatically when a thread is loaded (auto-link by email address match)
- Manually when the user explicitly links a thread to a deal or contact in the UI

**Thread label strategy for filtering:**
- Use Gmail query `q` parameter: `from:contact@example.com OR to:contact@example.com` in `listGmailThreads`.
- This is more efficient than loading all threads and filtering client-side.
- The existing `listGmailThreads` function accepts a `query` parameter — this is already wired correctly.

### What to Store Locally vs. Remotely

Do NOT attempt to sync the full Gmail message body to Supabase. Gmail provides the data on demand.

| Data | Storage |
|------|---------|
| `gmail_thread_links` table | Supabase |
| `gmail_tokens` (refresh token) | Supabase (server-only) |
| Thread list + message previews | Zustand (in-memory, no persist) |
| Full message bodies | Fetch from Gmail API on demand |
| Sent email record (CRMEmail) | Supabase `emails` table |

---

## 4. Anthropic Claude for CRM AI Features

### Current State Assessment

The existing `aiService.ts` has solid prompt engineering for:
- Contact enrichment (lead scoring, personality type, buying signals)
- Deal enrichment (win probability, key risks, next steps)
- Meeting prep generation
- Sales assistant streaming chat
- Email draft generation
- Daily brief generation
- NL command parsing

These prompts are well-structured. The problem is not the prompts — it is the **security architecture**: the API key
is in the browser.

### Lead Scoring Prompt Pattern (Enhancement)

The current `enrichContact` function returns a `leadScore` (0-100). To make this automatic and activity-aware,
the prompt should incorporate:

```typescript
const prompt = `You are a B2B lead scoring engine. Score this contact 0-100 based on their CRM data.

SCORING FACTORS:
- Fit signals: job seniority (C-level/VP = +20), company size, industry alignment
- Engagement signals: number of activities (each = +5, max +25), recency of last contact
- Buying signals: deal stage progression, notes mentioning "budget", "timeline", "decision"
- Risk signals: no activity in 30+ days (-10), status=churned (-30)

CONTACT:
- Name: ${contact.firstName} ${contact.lastName}
- Title: ${contact.jobTitle}
- Status: ${contact.status}
- Activities: ${activityCount} total, last contact: ${daysSinceLastContact} days ago
- Open deals: ${openDealCount}, highest stage: ${highestDealStage}
- Notes keywords: ${extractKeywords(contact.notes)}

Return ONLY a JSON object: { "score": <0-100>, "reasoning": "<2 sentences>" }`
```

**Key insight:** The score is more defensible when the prompt explicitly lists the scoring rubric. This makes the AI
output more consistent and allows you to display "why this score" to the user.

### Email Drafting with Contact + Thread Context

The existing `generateEmailDraft` function is functional but lacks email thread context. Enhance it by passing the
last N messages from the related Gmail thread:

```typescript
// Enhanced prompt with thread context
const threadContext = recentMessages.slice(0, 3).map(m =>
  `[${m.date}] ${m.from}: ${m.snippet}`
).join('\n')

const prompt = `Write a professional B2B follow-up email.

PREVIOUS CONVERSATION:
${threadContext}

RECIPIENT: ${contact.firstName} ${contact.lastName} (${contact.jobTitle} at ${company?.name})
INTENT: ${intent}
DEAL CONTEXT: ${deal ? `${deal.title} - currently ${deal.stage}` : 'none'}

Rules:
- Reference the previous conversation naturally
- Do not repeat information already discussed
- Keep under 150 words unless a proposal is requested
- Plain text, no markdown

Return ONLY: { "subject": "...", "body": "..." }`
```

### Call Transcript Summarization

This feature is not yet implemented. The pattern:

```typescript
export async function summarizeCallTranscript(
  transcript: string,
  contact: Contact,
  deal?: Deal,
): Promise<{
  summary: string
  keyPoints: string[]
  nextSteps: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  durationMinutes: number
}> {
  const prompt = `You are a B2B sales call analyst. Summarize this sales call transcript.

CONTEXT: Call with ${contact.firstName} ${contact.lastName} (${contact.jobTitle})
${deal ? `Related deal: ${deal.title} (${deal.stage})` : ''}

TRANSCRIPT:
${transcript.slice(0, 8000)} ${transcript.length > 8000 ? '[... truncated ...]' : ''}

Return ONLY a valid JSON object:
{
  "summary": "<3-4 sentence executive summary of the call>",
  "keyPoints": ["<point1>", "<point2>", "<point3>"],
  "nextSteps": ["<action1>", "<action2>"],
  "sentiment": "<positive|neutral|negative>",
  "commitments": ["<any commitments made by either party>"]
}

Do not include markdown in values.`
```

**Token budget:** Call transcripts can be very long. Enforce a `slice(0, 8000)` or equivalent character limit. At
approximately 4 chars/token, 8000 chars ≈ 2000 tokens of input. With a `max_tokens: 512` output, a call summary fits
comfortably in claude-haiku which keeps costs low.

**Model selection for different features:**

| Feature | Recommended Model | Reason |
|---------|------------------|--------|
| Lead scoring / deal analysis | claude-opus-4-6 | Complex reasoning, quality matters |
| Email drafting | claude-sonnet-4-5 | Good quality, faster than opus |
| Call summarization | claude-haiku-4-5 | Speed + cost for long transcripts |
| Chat assistant | User choice (current) | Keep as configurable |
| NL command parsing | claude-haiku (current) | Correct — fast/cheap for intent parsing |

### Streaming in Edge Functions

The current streaming implementation calls Anthropic directly from the browser with `dangerouslyAllowBrowser: true`.
When proxied through Supabase Edge Functions, streaming works via SSE (Server-Sent Events):

```typescript
// Edge Function returns a streaming response
const stream = await anthropic.messages.stream({
  model: "claude-opus-4-6",
  max_tokens: 2048,
  system: systemPrompt,
  messages,
})

// Convert to SSE response
const encoder = new TextEncoder()
const readable = new ReadableStream({
  async start(controller) {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
      }
    }
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller.close()
  }
})

return new Response(readable, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  }
})
```

The client-side `callStream` function in `aiService.ts` already handles SSE parsing for OpenRouter — the same pattern
works for the Supabase Edge Function proxy. The key change is replacing the direct Anthropic SDK call with a `fetch`
to the Edge Function URL.

---

## 5. Supabase Edge Functions as Claude API Proxy

### Why This Architecture Is Required

`dangerouslyAllowBrowser: true` in the current `aiService.ts` is a security acknowledgement, not a solution. It means:
- The Anthropic API key is readable in localStorage via DevTools or any XSS.
- The key is hardcoded in `zustand/persist` under key `crm_ai.apiKey`.
- If a user's key is compromised, the attacker has full Anthropic API access billed to that user.

The correct pattern: the Anthropic key lives only in Supabase Edge Function environment variables.

### Edge Function: claude-proxy

```typescript
// supabase/functions/claude-proxy/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Anthropic from "npm:@anthropic-ai/sdk@0.80.0"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
})

serve(async (req) => {
  // Verify user is authenticated
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { model, messages, system, max_tokens, stream: wantStream } = await req.json()

  // Validate model is an allowed model (prevent cost attacks)
  const ALLOWED_MODELS = [
    "claude-opus-4-6",
    "claude-sonnet-4-5-20251001",
    "claude-haiku-4-5-20251001",
  ]
  if (!ALLOWED_MODELS.includes(model)) {
    return new Response(JSON.stringify({ error: "Model not allowed" }), { status: 400 })
  }

  if (wantStream) {
    const stream = anthropic.messages.stream({ model, messages, system, max_tokens })
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            )
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      }
    })
    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
    })
  } else {
    const response = await anthropic.messages.create({ model, messages, system, max_tokens })
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

### Invoking the Proxy from the Client

Replace `makeClient(opts.anthropicKey)` in `aiService.ts` with a fetch to the Edge Function:

```typescript
const CLAUDE_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`

async function callClaude(params: {
  model: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  system?: string
  max_tokens?: number
}): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(CLAUDE_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({ ...params, stream: false }),
  })
  if (!res.ok) throw new Error(`Claude proxy error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}
```

### Supabase Edge Function Limits (Free Tier)

| Limit | Free Tier | Paid Tier |
|-------|-----------|-----------|
| Invocations/month | 500,000 | Unlimited |
| CPU time per invocation | 2 seconds | 2 seconds (wall clock: 150s) |
| Memory | 256 MB | 256 MB |
| Streaming timeout | 150 seconds wall clock | 150 seconds wall clock |

**Important:** The 2-second CPU time limit is for CPU-bound work. I/O-bound operations (waiting for Anthropic API,
waiting for Google token endpoint) do not consume CPU time. Streaming responses to Claude are I/O-bound and work fine
within the 150-second wall-clock limit.

**CORS:** Edge Functions require explicit CORS headers when called from a browser. Add:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-vercel-domain.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}
// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}
```

For local development, use `'*'` as the origin. Set the Vercel domain before production deploy.

### OpenRouter Proxy

The same proxy pattern applies to OpenRouter. Add an `openrouter-proxy` Edge Function that holds
`OPENROUTER_API_KEY` in Deno env. The client no longer sends its own key — it just calls the proxy.

---

## 6. XSS Prevention for AI-Generated Markdown in React

### The Existing Vulnerability

`AIAgent.tsx` line 315:
```tsx
dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
```

`renderMarkdown` is a hand-rolled regex transformer. It does not:
- Strip existing HTML tags from input
- Encode special characters (`<`, `>`, `&`)
- Prevent `<script>` injection
- Handle HTML injection in link URLs (`[click](javascript:alert(1))`)

If Claude's response ever contains `<img src=x onerror=alert(1)>` (prompt injection or supply chain attack), it
executes in the user's browser.

### Recommended Fix: DOMPurify + marked

**Option A: marked + DOMPurify (recommended)**

```bash
npm install marked dompurify
npm install -D @types/dompurify @types/marked
```

```typescript
import { marked } from 'marked'
import DOMPurify from 'dompurify'

function renderMarkdown(text: string): string {
  // marked converts markdown → HTML
  const rawHtml = marked.parse(text, {
    gfm: true,         // GitHub Flavored Markdown
    breaks: true,      // \n → <br>
  }) as string

  // DOMPurify strips dangerous HTML: <script>, onerror=, javascript: URLs, etc.
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'code', 'pre',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
      'blockquote', 'hr',
    ],
    ALLOWED_ATTR: ['class'],   // no href/src = no link injection
    FORCE_BODY: true,
  })
}
```

Then in the JSX:
```tsx
<div
  className="prose prose-invert prose-sm max-w-none"
  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
/>
```

`dangerouslySetInnerHTML` is still used, but it's now safe because DOMPurify has sanitized the output.

**Option B: react-markdown (alternative)**

```bash
npm install react-markdown rehype-sanitize remark-gfm
```

```tsx
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
    >
      {content}
    </ReactMarkdown>
  )
}
```

No `dangerouslySetInnerHTML` needed at all. `rehype-sanitize` strips unsafe HTML from the AST before rendering.

**Comparison:**

| | marked + DOMPurify | react-markdown |
|---|---|---|
| Bundle size | ~45KB (marked) + ~25KB (DOMPurify) | ~35KB + plugins |
| Streaming support | Yes (append string, re-render) | Yes |
| Custom component mapping | Manual CSS | Built-in via `components` prop |
| XSS protection | DOMPurify (battle-tested) | rehype-sanitize (well-maintained) |
| `dangerouslySetInnerHTML` | Still used (but sanitized) | Not needed |

**Recommendation: react-markdown + rehype-sanitize.** It is the idiomatic React approach, avoids `dangerouslySetInnerHTML`
entirely (better mental model), and the `components` prop makes it easy to style code blocks, links, etc. with Tailwind
classes. Use `remark-gfm` for tables and strikethrough support.

### Note on Streaming + react-markdown

During streaming (`isStreaming = true`), the partial markdown text may be malformed (e.g., an unclosed `**`). Both
`marked` and `react-markdown` handle partial markdown gracefully — they render what they can and treat unclosed
delimiters as plain text. No special handling needed for the streaming display.

---

## 7. Common Pitfalls and Rate Limiting

### Gmail API Rate Limits

| Limit | Value | Notes |
|-------|-------|-------|
| Quota units per user per day | 1,000,000,000 | Effectively unlimited for normal use |
| Messages.send per user per second | 10 | Burst limit |
| Messages.list per user per second | 10 | |
| Threads.get per user per second | 10 | |
| Concurrent connections | Not specified | Practical: ~5 parallel requests safe |

The current `listGmailThreads` fetches up to 10 thread details in parallel with `Promise.all`. This is at the edge of
the per-second rate limit. Add a small delay or use `Promise.allSettled` with batching if rate limit errors occur in
practice.

**429 handling pattern:**

```typescript
async function gmailFetchWithRetry<T>(path: string, token: string, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await gmailFetch<T>(path, token)
    } catch (err) {
      if (err instanceof Error && err.message.includes('429') && attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt))) // exponential backoff
        continue
      }
      throw err
    }
  }
  throw new Error('Gmail API: max retries exceeded')
}
```

### Google OAuth Verification Requirement

**This is the most commonly missed production requirement.**

Gmail scopes (`gmail.readonly`, `gmail.send`, `gmail.modify`) are **restricted** per Google's OAuth 2.0 Policies.
Apps using restricted scopes are limited to 100 test users until they pass Google's verification process. Verification
involves:

1. Submitting a privacy policy URL and homepage URL
2. Completing a security assessment if requesting restricted scopes
3. Video demo of the OAuth consent flow
4. 4-6 week review period

Plan for this in the launch timeline. During development, add all team members as test users in Google Cloud Console
under "OAuth consent screen > Test users."

### Token Expiry Edge Case: Refresh Token Revocation

Refresh tokens can be revoked by the user (Google Account settings > Third-party apps) or invalidated by Google
(account inactivity, password change, too many refresh tokens for the app). Your Edge Function must handle this:

```typescript
// In gmail-refresh-token Edge Function
const tokenRes = await fetch("https://oauth2.googleapis.com/token", { ... })
const data = await tokenRes.json()

if (data.error === 'invalid_grant') {
  // Refresh token is revoked. Delete the token row and signal re-auth needed.
  await supabase.from('gmail_tokens').delete().eq('user_id', userId)
  return new Response(JSON.stringify({ error: 'gmail_reauth_required' }), { status: 401 })
}
```

The client must handle `gmail_reauth_required` by showing the "Connect Gmail" button again.

### Pitfall: `prompt=consent` and Quota Limits

Google limits how many refresh tokens can be issued per user per client application. If you always request
`prompt=consent`, each re-authorization creates a new refresh token and **invalidates all previous ones**. This is
correct behavior — but if a user re-authorizes frequently (e.g., during testing), old sessions break.

For production: only add `prompt=consent` when you specifically need a new refresh token (first authorization, or
after detecting `invalid_grant`). Normal re-authorizations should use `prompt=select_account` or omit `prompt`.

### Pitfall: `access_type=offline` Without Consent Screen

`access_type=offline` is required to receive a refresh token, but Google only issues a refresh token during the
**consent screen**. If the user has previously consented and you do not force `prompt=consent`, subsequent
authorizations return `access_type=offline` with no `refresh_token` in the response.

Always check `if (!tokens.refresh_token)` in the Edge Function and handle accordingly.

### Pitfall: Anthropic API Key in Zustand Persist

The current `aiStore.ts` persists `apiKey` to localStorage under key `crm_ai`. After migrating to the Edge Function
proxy, this field should be removed from the store entirely. The user should never need to enter an Anthropic key —
it lives in the server environment. Remove:
- `apiKey` from `AIStore` interface
- `setApiKey` action
- `apiKey` from `partialize`
- The API key input in `Settings.tsx`
- All `dangerouslyAllowBrowser: true` usage

### Pitfall: Calling Gmail API Directly from Client with Stored Token

After implementing the OAuth proxy, you will still need to call the Gmail REST API from the client (read threads,
send emails). This is acceptable — the Gmail API itself is designed to be called from client applications. The key
distinction:

- Gmail REST API (reads, sends) → Call from browser with short-lived access_token (OK)
- Google token exchange / refresh → Must go through Edge Function (never expose client_secret)
- Anthropic API → Must go through Edge Function (never expose API key in browser)

### Pitfall: XSS via AI Response Before Sanitization Is Added

The `dangerouslySetInnerHTML` in `AIAgent.tsx` is a live vulnerability. This should be the **first fix** before any
other AI features are added, as every new AI response surface (email drafts, call summaries, etc.) that uses this
renderer inherits the XSS risk.

Priority order for security fixes:
1. Sanitize AI markdown output (react-markdown + rehype-sanitize)
2. Move Anthropic key to Edge Function (remove from localStorage)
3. Move Gmail refresh token to Supabase (never in localStorage)
4. Move Gmail access token to memory-only Zustand (no persist)

### Pitfall: Supabase Edge Function Cold Starts

Supabase Edge Functions (Deno Deploy) have cold start latency of 50-300ms on the free tier. For streaming chat
responses, this adds a perceptible delay before the first token arrives. Mitigations:

1. Show a loading indicator immediately on send (already implemented in `AIAgent.tsx`).
2. Keep Edge Functions warm by calling a lightweight health-check endpoint on page load (not recommended for free
   tier — wastes invocations).
3. Accept the cold start as a UX cost at free tier and optimize post-launch if needed.

### Pitfall: CORS in Edge Functions During Vercel Preview Deploys

Vercel preview deploys use dynamic URLs (`https://crm-app-git-feature-xyz.vercel.app`). If CORS is restricted to the
production domain only, preview deploys will fail. Use an environment variable for the allowed origin:

```typescript
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*"
```

Set `ALLOWED_ORIGIN=https://your-production-domain.com` in Supabase secrets for production, and leave it as `*`
for development.

### Pitfall: `marked` v9+ Breaking Changes

If `marked` is installed at v9+, the API changed: `marked(text)` is now async by default. Use `marked.parse(text)`
for synchronous output (still synchronous in v9+ when no async extensions are registered), or use `await marked(text)`.
The `marked.parse()` synchronous API is stable and correct for this use case.

---

## Summary of Recommended Changes

| Area | Current State | Recommended Change | Priority |
|------|-------------|-------------------|----------|
| Gmail auth flow | GIS Token Client (implicit-like) | Auth Code + PKCE via `initCodeClient` or manual URL | High |
| Refresh token storage | Not obtained / not stored | Supabase `gmail_tokens` table via Edge Function | High |
| Access token storage | Zustand `persist` (localStorage) | Zustand memory-only (no persist) | High |
| Anthropic API calls | Direct from browser, key in localStorage | Supabase Edge Function proxy | High |
| AI markdown rendering | Hand-rolled regex + `dangerouslySetInnerHTML` | react-markdown + rehype-sanitize | High |
| Call summarization | Not implemented | Add to `aiService.ts` via proxy | Medium |
| Thread-to-contact linking | Not implemented | Email address matching + `gmail_thread_links` table | Medium |
| Gmail scope | send + readonly + compose | send + readonly + modify (drop compose) | Low |
| Rate limit handling | No retry logic | Exponential backoff on 429s | Low |

---

## Packages to Add

```bash
# XSS-safe markdown rendering
npm install react-markdown rehype-sanitize remark-gfm

# OR the DOMPurify approach
npm install marked dompurify
npm install -D @types/dompurify
```

No additional packages needed for Gmail PKCE (manual URL construction uses built-in `crypto.subtle` for SHA-256 and
`crypto.getRandomValues` for the verifier — both available in all modern browsers and Deno).

The `@anthropic-ai/sdk` package should remain in `package.json` for use in Supabase Edge Functions. In the browser
bundle, remove `dangerouslyAllowBrowser: true` and remove the direct SDK instantiation entirely.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Gmail PKCE / Auth Code flow | HIGH | Google OAuth2 spec, GIS documentation (well-established) |
| `prompt=consent` + `access_type=offline` behavior | HIGH | Documented Google OAuth behavior, widely verified |
| Supabase Edge Function patterns | HIGH | Supabase docs (Deno Deploy, Deno std patterns) |
| Anthropic SDK streaming | HIGH | SDK source code visible in `aiService.ts`, API design is stable |
| react-markdown + rehype-sanitize | HIGH | Widely used pattern, stable API |
| DOMPurify sanitization behavior | HIGH | Battle-tested library, well-documented |
| Supabase free tier limits | MEDIUM | Known at training cutoff; verify current limits at supabase.com/pricing |
| Google OAuth verification timeline | MEDIUM | 4-6 weeks is historical average; current timeline may vary |
