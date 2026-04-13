-- Automations v1: execution logs for traceability/debugging.

CREATE TABLE IF NOT EXISTS public.automation_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  context jsonb NOT NULL DEFAULT '{}',
  result jsonb NOT NULL DEFAULT '{}',
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_automation_executions_org_created
  ON public.automation_executions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_executions_rule
  ON public.automation_executions (rule_id);

ALTER TABLE public.automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_automation_executions" ON public.automation_executions;
CREATE POLICY "org_read_automation_executions"
  ON public.automation_executions
  FOR SELECT
  USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_automation_executions" ON public.automation_executions;
CREATE POLICY "org_write_automation_executions"
  ON public.automation_executions
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'manager', 'sales_rep', 'owner')
  );
