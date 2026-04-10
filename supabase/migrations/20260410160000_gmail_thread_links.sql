-- Migration: Persist Gmail thread -> CRM entity links
-- Purpose: allow teams to pin/unpin thread relationships (contact/company/deal)

CREATE TABLE IF NOT EXISTS public.gmail_thread_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id       text        NOT NULL,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id      uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id         uuid        REFERENCES public.deals(id) ON DELETE SET NULL,
  source          text        NOT NULL DEFAULT 'manual' CHECK (source IN ('auto', 'manual')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_gmail_thread_links_org_user
  ON public.gmail_thread_links(organization_id, user_id);

CREATE INDEX IF NOT EXISTS idx_gmail_thread_links_thread
  ON public.gmail_thread_links(thread_id);

ALTER TABLE public.gmail_thread_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_gmail_thread_links" ON public.gmail_thread_links;
DROP POLICY IF EXISTS "org_write_gmail_thread_links" ON public.gmail_thread_links;

CREATE POLICY "org_read_gmail_thread_links"
  ON public.gmail_thread_links
  FOR SELECT
  USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );

CREATE POLICY "org_write_gmail_thread_links"
  ON public.gmail_thread_links
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );

DROP TRIGGER IF EXISTS set_updated_at ON public.gmail_thread_links;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.gmail_thread_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
