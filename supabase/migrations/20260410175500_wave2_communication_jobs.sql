-- Wave 2: server-driven communication jobs queue (mail + sequences)

CREATE TABLE IF NOT EXISTS public.communication_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('email_send', 'sequence_step')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  run_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key text,
  last_error text,
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS communication_jobs_org_dedupe_unique_idx
  ON public.communication_jobs (organization_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_jobs_org_status_runat_idx
  ON public.communication_jobs (organization_id, status, run_at);

CREATE INDEX IF NOT EXISTS communication_jobs_due_queue_idx
  ON public.communication_jobs (status, run_at)
  WHERE status IN ('queued', 'processing');

DROP TRIGGER IF EXISTS set_updated_at ON public.communication_jobs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.communication_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.communication_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_read_communication_jobs"
  ON public.communication_jobs
  FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "org_manage_communication_jobs"
  ON public.communication_jobs
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );
