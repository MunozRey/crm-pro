---
phase: 07-gmail-integration
plan: 2
subsystem: backend
tags: [gmail, oauth, edge-functions, security, supabase]
dependency_graph:
  requires: [07-1]
  provides: [gmail-oauth-exchange, gmail-refresh-token, gmail_tokens-table]
  affects: [07-3, 07-4]
tech_stack:
  added: []
  patterns: [Deno Edge Function, PKCE token exchange, service-role admin client, RLS per-user isolation]
key_files:
  created:
    - supabase/schema.sql
    - supabase/functions/gmail-oauth-exchange/index.ts
    - supabase/functions/gmail-refresh-token/index.ts
  modified: []
decisions:
  - access_token column exists in gmail_tokens but is always written as null — intentional, schema allows future caching but current policy is never-store
  - upsert on user_id conflict in oauth-exchange handles reconnect without orphaned rows
  - gmail-refresh-token requires no request body — user identity derived from Supabase JWT only
metrics:
  duration: 10m
  completed: "2026-04-09"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 0
---

# Phase 07 Plan 2: Gmail Token Exchange Edge Functions Summary

**One-liner:** Two Deno Edge Functions implement secure PKCE token exchange and refresh — refresh tokens stored server-side only, browser never receives them.

## What Was Built

### gmail_tokens table (supabase/schema.sql)
- Per-user table storing `refresh_token`, `email_address`, `scopes`, `token_expiry`
- `access_token` column intentionally nullable — never persisted (written as null on every upsert)
- RLS: `auth.uid() = user_id` — users can only read/write their own row
- Appended after existing RLS policies in schema.sql

### gmail-oauth-exchange Edge Function
- Receives `{ code, code_verifier, redirect_uri }` from SPA callback
- Verifies caller Supabase session via JWT (callerClient pattern from invite-member)
- Posts to `https://oauth2.googleapis.com/token` with `GOOGLE_CLIENT_SECRET` (server-side env var)
- Fetches Gmail profile to get `emailAddress`
- Upserts `refresh_token` into `gmail_tokens` using service-role adminClient
- Returns only `{ access_token, expires_in, email_address }` — refresh token never leaves server

### gmail-refresh-token Edge Function
- No request body required — user identity from Supabase JWT
- Reads `refresh_token` from `gmail_tokens` using service-role adminClient
- Posts refresh grant to Google token endpoint with `GOOGLE_CLIENT_SECRET`
- Handles `invalid_grant` (revoked token) with `code` field in error response
- Returns only `{ access_token, expires_in, email_address }` — refresh token stays in DB

## Security Properties

- `GOOGLE_CLIENT_SECRET` only appears in Edge Function env — no `VITE_` prefix anywhere
- Browser never receives `refresh_token` in any response path
- Both functions verify Supabase session before any Google API call
- RLS prevents any user from reading another user's gmail_tokens row

## Deviations from Plan

None — plan executed exactly as written.

## Manual Steps Required (user must perform)

1. Apply schema: `supabase db push` or paste gmail_tokens block into Supabase SQL editor
2. Deploy functions: `supabase functions deploy gmail-oauth-exchange && supabase functions deploy gmail-refresh-token`
3. Set Edge Function secrets: `supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`

## Self-Check: PASSED

- supabase/schema.sql: CREATE TABLE IF NOT EXISTS public.gmail_tokens — found at line 155
- supabase/functions/gmail-oauth-exchange/index.ts — exists, commit b849be77
- supabase/functions/gmail-refresh-token/index.ts — exists, commit 75c2c14d
- No VITE_ vars in either Edge Function — confirmed
- refresh_token count in oauth-exchange: 4 matches (read, check, store, error msg) — confirmed
