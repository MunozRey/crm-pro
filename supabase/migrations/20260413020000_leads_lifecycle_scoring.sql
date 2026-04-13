-- Lead engine baseline (Pipedrive + HubSpot style)

CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_name text,
  job_title text,
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'open',
  lifecycle_stage text NOT NULL DEFAULT 'lead'
    CHECK (lifecycle_stage IN ('subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer')),
  score integer NOT NULL DEFAULT 0,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  last_engaged_at timestamptz,
  converted_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  converted_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  converted_deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_org_stage_score
  ON public.leads (organization_id, lifecycle_stage, score DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_org_assigned
  ON public.leads (organization_id, assigned_to);

CREATE UNIQUE INDEX IF NOT EXISTS leads_unique_email_per_org
  ON public.leads (organization_id, lower(email));

DROP TRIGGER IF EXISTS set_updated_at ON public.leads;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('email_open', 'email_click', 'email_reply', 'meeting_booked', 'note_added', 'manual_score_adjustment')),
  event_value integer,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_events_org_lead_created
  ON public.lead_events (organization_id, lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lead_scoring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

DROP TRIGGER IF EXISTS set_updated_at ON public.lead_scoring_rules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lead_scoring_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.lead_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  score integer NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_snapshots_org_lead_created
  ON public.lead_score_snapshots (organization_id, lead_id, created_at DESC);

-- Default rules for existing organizations.
INSERT INTO public.lead_scoring_rules (organization_id, key, points, is_enabled)
SELECT o.id, rule.key, rule.points, true
FROM public.organizations o
CROSS JOIN (
  VALUES
    ('email_open', 5),
    ('email_click', 12),
    ('email_reply', 20),
    ('meeting_booked', 30)
) AS rule(key, points)
ON CONFLICT (organization_id, key) DO NOTHING;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_score_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_leads" ON public.leads;
CREATE POLICY "org_read_leads" ON public.leads
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_leads" ON public.leads;
CREATE POLICY "org_write_leads" ON public.leads
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_read_lead_events" ON public.lead_events;
CREATE POLICY "org_read_lead_events" ON public.lead_events
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_lead_events" ON public.lead_events;
CREATE POLICY "org_write_lead_events" ON public.lead_events
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_read_lead_scoring_rules" ON public.lead_scoring_rules;
CREATE POLICY "org_read_lead_scoring_rules" ON public.lead_scoring_rules
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_lead_scoring_rules" ON public.lead_scoring_rules;
CREATE POLICY "org_write_lead_scoring_rules" ON public.lead_scoring_rules
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_read_lead_score_snapshots" ON public.lead_score_snapshots;
CREATE POLICY "org_read_lead_score_snapshots" ON public.lead_score_snapshots
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_lead_score_snapshots" ON public.lead_score_snapshots;
CREATE POLICY "org_write_lead_score_snapshots" ON public.lead_score_snapshots
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());
