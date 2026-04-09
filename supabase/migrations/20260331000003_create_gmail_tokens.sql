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

-- ─── gmail_tokens: add organization_id column (table created in base schema 000) ─
ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'Bearer';

ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS scope text;

ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Rename columns to match updated schema (base schema used different names)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='gmail_tokens' AND column_name='token_expiry') THEN
    ALTER TABLE public.gmail_tokens RENAME COLUMN token_expiry TO expires_at_old;
  END IF;
END $$;

-- Drop old temp RLS policy from base schema, replace with org-aware one
DROP POLICY IF EXISTS "own_gmail_tokens" ON public.gmail_tokens;

-- Index for RLS lookups and joins
CREATE INDEX IF NOT EXISTS idx_gmail_tokens_user_org
  ON public.gmail_tokens(user_id, organization_id);

-- RLS: each user may only read/write their own tokens for their own org.
-- get_org_id() is defined in migration 001.
CREATE POLICY "users_own_gmail_tokens" ON public.gmail_tokens
  FOR ALL USING (
    user_id = auth.uid()
  );

-- updated_at trigger — already created in base schema 000, skip if exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at' AND tgrelid = 'public.gmail_tokens'::regclass) THEN
    CREATE TRIGGER set_updated_at
      BEFORE UPDATE ON public.gmail_tokens
      FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
