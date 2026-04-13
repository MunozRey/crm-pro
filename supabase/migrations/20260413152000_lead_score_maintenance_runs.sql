CREATE TABLE IF NOT EXISTS public.lead_score_maintenance_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('single_org', 'all_orgs')),
  status text NOT NULL CHECK (status IN ('running', 'success', 'error')),
  processed integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lead_score_maintenance_runs_org_started
  ON public.lead_score_maintenance_runs (organization_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_score_maintenance_runs_started
  ON public.lead_score_maintenance_runs (started_at DESC);

ALTER TABLE public.lead_score_maintenance_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_lead_score_maintenance_runs" ON public.lead_score_maintenance_runs;
CREATE POLICY "org_read_lead_score_maintenance_runs" ON public.lead_score_maintenance_runs
  FOR SELECT USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_lead_score_maintenance_runs" ON public.lead_score_maintenance_runs;
CREATE POLICY "org_write_lead_score_maintenance_runs" ON public.lead_score_maintenance_runs
  FOR ALL USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());
