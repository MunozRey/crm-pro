-- Hubspot-like email tracking primitives
-- Stores open/click telemetry per email and per link, scoped by organization.

CREATE TABLE IF NOT EXISTS public.email_tracking_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  open_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_messages_org_email
  ON public.email_tracking_messages (organization_id, email_id);

CREATE TABLE IF NOT EXISTS public.email_tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_message_id uuid NOT NULL REFERENCES public.email_tracking_messages(id) ON DELETE CASCADE,
  email_id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  original_url text NOT NULL,
  click_token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_links_org_email
  ON public.email_tracking_links (organization_id, email_id);

CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_message_id uuid NOT NULL REFERENCES public.email_tracking_messages(id) ON DELETE CASCADE,
  link_id uuid REFERENCES public.email_tracking_links(id) ON DELETE SET NULL,
  email_id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('open', 'click')),
  user_agent text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_events_org_email_type
  ON public.email_tracking_events (organization_id, email_id, event_type, created_at DESC);

ALTER TABLE public.email_tracking_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_tracking_messages" ON public.email_tracking_messages;
CREATE POLICY "org_read_tracking_messages" ON public.email_tracking_messages
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_tracking_messages" ON public.email_tracking_messages;
CREATE POLICY "org_write_tracking_messages" ON public.email_tracking_messages
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_read_tracking_links" ON public.email_tracking_links;
CREATE POLICY "org_read_tracking_links" ON public.email_tracking_links
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_tracking_links" ON public.email_tracking_links;
CREATE POLICY "org_write_tracking_links" ON public.email_tracking_links
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_read_tracking_events" ON public.email_tracking_events;
CREATE POLICY "org_read_tracking_events" ON public.email_tracking_events
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_tracking_events" ON public.email_tracking_events;
CREATE POLICY "org_write_tracking_events" ON public.email_tracking_events
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());
