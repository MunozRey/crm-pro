-- Canonicalize gmail_tokens columns and constraints.
-- This keeps compatibility with legacy columns from base schema and aligns edge functions/types.

ALTER TABLE public.gmail_tokens
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS email_address text,
  ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'Bearer',
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill canonical columns from legacy ones if they still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gmail_tokens' AND column_name = 'scopes'
  ) THEN
    EXECUTE 'UPDATE public.gmail_tokens SET scope = COALESCE(scope, scopes)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gmail_tokens' AND column_name = 'token_expiry'
  ) THEN
    EXECUTE 'UPDATE public.gmail_tokens SET expires_at = COALESCE(expires_at, token_expiry)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gmail_tokens' AND column_name = 'expires_at_old'
  ) THEN
    EXECUTE 'UPDATE public.gmail_tokens SET expires_at = COALESCE(expires_at, expires_at_old)';
  END IF;
END
$$;

-- Best-effort org backfill for existing rows.
UPDATE public.gmail_tokens gt
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE gt.organization_id IS NULL
  AND om.user_id = gt.user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_tokens_user_org_unique
  ON public.gmail_tokens(user_id, organization_id);
