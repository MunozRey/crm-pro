---
phase: 07-gmail-integration
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/schema.sql
  - supabase/functions/gmail-oauth-exchange/index.ts
  - supabase/functions/gmail-refresh-token/index.ts
autonomous: true
requirements:
  - GMAIL-02
  - GMAIL-03
  - SEC-05

must_haves:
  truths:
    - "gmail_tokens table exists in Supabase with RLS preventing cross-user reads"
    - "Calling gmail-oauth-exchange with a valid code and verifier returns an access_token; refresh_token is stored server-side only"
    - "Calling gmail-refresh-token with a valid session returns a new access_token without the browser ever seeing the refresh_token"
  artifacts:
    - path: "supabase/schema.sql"
      provides: "gmail_tokens table CREATE statement with RLS"
      contains: "CREATE TABLE IF NOT EXISTS public.gmail_tokens"
    - path: "supabase/functions/gmail-oauth-exchange/index.ts"
      provides: "Deno Edge Function: code + verifier → tokens; writes refresh_token to gmail_tokens"
    - path: "supabase/functions/gmail-refresh-token/index.ts"
      provides: "Deno Edge Function: reads refresh_token from gmail_tokens → returns new access_token"
  key_links:
    - from: "supabase/functions/gmail-oauth-exchange/index.ts"
      to: "public.gmail_tokens"
      via: "adminClient.from('gmail_tokens').upsert()"
      pattern: "gmail_tokens"
    - from: "supabase/functions/gmail-refresh-token/index.ts"
      to: "public.gmail_tokens"
      via: "adminClient.from('gmail_tokens').select('refresh_token')"
      pattern: "refresh_token"
---

<objective>
Create the two Supabase Edge Functions that form the secure backend for Gmail token exchange, plus add the `gmail_tokens` table SQL to schema.sql (it was planned in Phase 1 but not written to the file).

Purpose: The browser must NEVER handle refresh tokens. These Edge Functions are the only server-side path that touches Google's token endpoint, storing and reading refresh tokens from the database.

Output:
- `supabase/schema.sql` — gmail_tokens table + RLS policy appended
- `supabase/functions/gmail-oauth-exchange/index.ts` — exchanges auth code + code_verifier for tokens; stores refresh_token in DB; returns access_token to browser
- `supabase/functions/gmail-refresh-token/index.ts` — reads stored refresh_token; calls Google refresh endpoint; returns new access_token to browser
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/07-gmail-integration/07-CONTEXT.md
@supabase/functions/invite-member/index.ts

<interfaces>
<!-- invite-member pattern (canonical reference for all Edge Functions): -->
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // Caller JWT verification:
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
  const { data: { user }, error } = await callerClient.auth.getUser()
  // Admin writes:
  const adminClient = createClient(url, serviceRoleKey)
  // Response:
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
})
```

<!-- gmail_tokens table schema (from key_research_findings — MUST use exactly): -->
```sql
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expiry timestamptz,
  scopes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own gmail tokens"
  ON public.gmail_tokens FOR ALL
  USING (auth.uid() = user_id);
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add gmail_tokens table to supabase/schema.sql</name>
  <files>supabase/schema.sql</files>
  <read_first>
    - supabase/schema.sql (read last 50 lines to find the correct append point — do not duplicate any existing table)
  </read_first>
  <action>
Append the `gmail_tokens` table definition to `supabase/schema.sql`. The table was planned in Phase 1 but never written to the file (confirmed by research). Append at the end of the file, after the last existing CREATE TABLE / ALTER TABLE block:

```sql
-- ─── Gmail Tokens ─────────────────────────────────────────────────────────────
-- Stores server-side refresh tokens for Gmail OAuth. Access tokens are NEVER stored here.
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  token_expiry timestamptz,
  scopes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own gmail tokens"
  ON public.gmail_tokens FOR ALL
  USING (auth.uid() = user_id);
```

Do NOT add an `organization_id` column — gmail tokens are per-user, not per-org (one Gmail account per user). Do NOT modify any existing tables or policies.
  </action>
  <verify>
    <automated>grep -n "gmail_tokens\|Users can only access own gmail" /c/Users/david/OneDrive/Escritorio/Development/CRM/supabase/schema.sql</automated>
  </verify>
  <acceptance_criteria>
    - `grep "CREATE TABLE IF NOT EXISTS public.gmail_tokens" supabase/schema.sql` returns a match
    - `grep "refresh_token text NOT NULL" supabase/schema.sql` returns a match
    - `grep "ENABLE ROW LEVEL SECURITY" supabase/schema.sql | grep -c "gmail_tokens"` — RLS is enabled after the table (check via line proximity)
    - `grep "Users can only access own gmail tokens" supabase/schema.sql` returns a match
    - `grep "organization_id" supabase/schema.sql | grep "gmail_tokens"` returns NO match
  </acceptance_criteria>
  <done>gmail_tokens table with RLS is defined in schema.sql and can be applied to Supabase via the SQL editor or CLI.</done>
</task>

<task type="auto">
  <name>Task 2: Create gmail-oauth-exchange Edge Function</name>
  <files>supabase/functions/gmail-oauth-exchange/index.ts</files>
  <read_first>
    - supabase/functions/invite-member/index.ts (follow this pattern exactly for CORS, JWT verification, admin client, and response format)
    - .planning/phases/07-gmail-integration/07-CONTEXT.md (D-07: refresh token server-side only, browser never sees it)
  </read_first>
  <action>
Create `supabase/functions/gmail-oauth-exchange/index.ts`. This function receives `{ code, code_verifier, redirect_uri }` from the SPA callback page, exchanges it for Google tokens, stores the refresh token in `gmail_tokens`, and returns only the short-lived access token to the browser.

Full implementation:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code, code_verifier, redirect_uri } = await req.json() as {
      code: string
      code_verifier: string
      redirect_uri: string
    }

    if (!code || !code_verifier || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: 'code, code_verifier, and redirect_uri are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the calling user holds a valid Supabase session
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange code + verifier for tokens at Google token endpoint
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        code_verifier,
        redirect_uri,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: errBody.error_description ?? 'Google token exchange failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokens = await tokenRes.json() as {
      access_token: string
      refresh_token?: string
      expires_in: number
      scope: string
      token_type: string
    }

    if (!tokens.refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No refresh_token returned — user must re-authorize with prompt=consent' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch Gmail profile to get email address
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json() as { emailAddress: string }

    // Store refresh token in gmail_tokens (admin client — service role)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: upsertErr } = await adminClient
      .from('gmail_tokens')
      .upsert({
        user_id: user.id,
        email_address: profile.emailAddress,
        refresh_token: tokens.refresh_token,
        access_token: null,   // Never store access token in DB
        token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        scopes: tokens.scope,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return ONLY the short-lived access token and email address — refresh token stays server-side
    return new Response(
      JSON.stringify({
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        email_address: profile.emailAddress,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Note on env vars** (must be set in Supabase Edge Function secrets):
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (same value as VITE_GOOGLE_CLIENT_ID)
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret (NEVER a VITE_ prefix)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — auto-injected by Supabase
  </action>
  <verify>
    <automated>grep -n "refresh_token\|access_token\|gmail_tokens\|GOOGLE_CLIENT_SECRET\|upsert" /c/Users/david/OneDrive/Escritorio/Development/CRM/supabase/functions/gmail-oauth-exchange/index.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `supabase/functions/gmail-oauth-exchange/index.ts` exists
    - `grep "GOOGLE_CLIENT_SECRET" supabase/functions/gmail-oauth-exchange/index.ts` returns a match (secret used server-side)
    - `grep "VITE_" supabase/functions/gmail-oauth-exchange/index.ts` returns NO match (no browser env vars in Edge Function)
    - `grep "access_token: null" supabase/functions/gmail-oauth-exchange/index.ts` returns a match (access token NOT stored in DB)
    - `grep "refresh_token.*return\|return.*refresh_token" supabase/functions/gmail-oauth-exchange/index.ts` returns NO match (refresh token not returned to browser)
    - `grep "upsert" supabase/functions/gmail-oauth-exchange/index.ts` returns a match (not insert — handles reconnect)
    - `grep "Authorization.*req.headers" supabase/functions/gmail-oauth-exchange/index.ts` returns a match (caller JWT verified)
  </acceptance_criteria>
  <done>Edge Function exchanges code for tokens, stores refresh_token in DB, returns only access_token + email_address to browser. Refresh token is never exposed to the browser.</done>
</task>

<task type="auto">
  <name>Task 3: Create gmail-refresh-token Edge Function</name>
  <files>supabase/functions/gmail-refresh-token/index.ts</files>
  <read_first>
    - supabase/functions/invite-member/index.ts (follow CORS + JWT pattern)
    - supabase/functions/gmail-oauth-exchange/index.ts (just created — keep the response shape consistent: { access_token, expires_in, email_address })
  </read_first>
  <action>
Create `supabase/functions/gmail-refresh-token/index.ts`. This function reads the stored `refresh_token` for the calling user, hits Google's token refresh endpoint, and returns a new short-lived `access_token`. No request body is needed — it uses the caller's JWT to identify the user.

Full implementation:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify calling user holds a valid Supabase session
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read the stored refresh token for this user (admin client bypasses RLS for server reads)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: tokenRow, error: fetchErr } = await adminClient
      .from('gmail_tokens')
      .select('refresh_token, email_address')
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: 'No Gmail connection found for this user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Refresh the access token at Google's token endpoint
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenRow.refresh_token,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshRes.ok) {
      const errBody = await refreshRes.json().catch(() => ({}))
      // 400 with error=invalid_grant means refresh token was revoked by user
      return new Response(
        JSON.stringify({ error: errBody.error_description ?? 'Token refresh failed', code: errBody.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const refreshed = await refreshRes.json() as {
      access_token: string
      expires_in: number
      scope: string
      token_type: string
    }

    // Return ONLY the new short-lived access token — refresh token stays in the DB
    return new Response(
      JSON.stringify({
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
        email_address: tokenRow.email_address,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```
  </action>
  <verify>
    <automated>grep -n "refresh_token\|GOOGLE_CLIENT_SECRET\|gmail_tokens\|single\(\)" /c/Users/david/OneDrive/Escritorio/Development/CRM/supabase/functions/gmail-refresh-token/index.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `supabase/functions/gmail-refresh-token/index.ts` exists
    - `grep "grant_type.*refresh_token" supabase/functions/gmail-refresh-token/index.ts` returns a match
    - `grep "GOOGLE_CLIENT_SECRET" supabase/functions/gmail-refresh-token/index.ts` returns a match
    - `grep "return.*refresh_token\|refresh_token.*JSON" supabase/functions/gmail-refresh-token/index.ts` returns NO match for the response body (refresh token not returned to browser)
    - `grep "invalid_grant" supabase/functions/gmail-refresh-token/index.ts` returns a match (revoked token handled)
    - `grep "single()" supabase/functions/gmail-refresh-token/index.ts` returns a match (reads one row for the user)
    - `grep "Authorization.*req.headers" supabase/functions/gmail-refresh-token/index.ts` returns a match
  </acceptance_criteria>
  <done>Edge Function reads stored refresh_token, hits Google refresh endpoint, returns new access_token to browser only. User's refresh_token never leaves the server.</done>
</task>

</tasks>

<verification>
After all tasks:

1. `grep "CREATE TABLE IF NOT EXISTS public.gmail_tokens" supabase/schema.sql` — has output
2. `ls supabase/functions/gmail-oauth-exchange/index.ts` — file exists
3. `ls supabase/functions/gmail-refresh-token/index.ts` — file exists
4. `grep "VITE_" supabase/functions/gmail-oauth-exchange/index.ts supabase/functions/gmail-refresh-token/index.ts` — no output (no browser env vars in Edge Functions)
5. `grep -c "refresh_token" supabase/functions/gmail-oauth-exchange/index.ts` — count > 0 (refresh token handled)

Manual (user must perform in Supabase dashboard):
- Apply schema.sql changes via SQL editor or `supabase db push`
- Deploy Edge Functions: `supabase functions deploy gmail-oauth-exchange && supabase functions deploy gmail-refresh-token`
- Set Edge Function secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
</verification>

<success_criteria>
- gmail_tokens table definition exists in schema.sql with RLS policy
- gmail-oauth-exchange exchanges auth code for tokens, stores only refresh_token in DB, returns only access_token to browser
- gmail-refresh-token reads stored refresh_token, returns new access_token to browser only
- No refresh token appears in any response body sent to the browser
- Both functions follow the invite-member pattern for CORS headers, JWT verification, and admin client usage
</success_criteria>

<output>
After completion, create `.planning/phases/07-gmail-integration/07-2-SUMMARY.md`
</output>
