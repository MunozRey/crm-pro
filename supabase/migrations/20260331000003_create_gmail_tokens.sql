-- Migration 003: Create gmail_tokens table
-- Depends on: 20260331000001_create_org_tables.sql (organizations table + get_org_id helper)
-- Wave: 1 (parallel authoring with Plan 1.2) but apply AFTER migration 001
-- Plan: 01.3
-- Purpose: Server-side storage for Gmail OAuth refresh tokens (SCHEMA-05, SEC-05).
--          Refresh tokens MUST never be stored in the browser or localStorage.
--          Phase 8 Edge Functions read/write this table using the service role key.

-- NOTE: public.get_org_id() is defined in migration 001 (Plan 1.2).
--       Apply migration 001 before this file.
--       public.handle_updated_at() is defined in schema.sql (baseline) — do not redefine.

-- ─── gmail_tokens ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token    text,                         -- short-lived; may be NULL between refreshes
  refresh_token   text        NOT NULL,         -- long-lived; encrypted at rest by Supabase
  token_type      text        NOT NULL DEFAULT 'Bearer',
  scope           text        NOT NULL,         -- space-separated Gmail scopes granted
  expires_at      timestamptz,                  -- when the access_token expires
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)              -- one token set per user per org
);

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Index for RLS lookups and joins
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_org
  ON public.gmail_tokens(user_id, organization_id);

-- RLS: each user may only read/write their own tokens for their own org.
-- get_org_id() is defined in migration 001.
CREATE POLICY "users_own_gmail_tokens" ON public.gmail_tokens
  FOR ALL USING (
    user_id = auth.uid()
    AND organization_id = public.get_org_id()
  );

-- updated_at trigger — reuses existing handle_updated_at() from schema.sql
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.gmail_tokens
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
