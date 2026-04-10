-- Shared Inbox workspace metadata per Gmail thread

CREATE TABLE IF NOT EXISTS public.gmail_thread_workspace (
  thread_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS gmail_thread_workspace_org_idx
  ON public.gmail_thread_workspace (organization_id, updated_at DESC);

ALTER TABLE public.gmail_thread_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_gmail_thread_workspace" ON public.gmail_thread_workspace;
DROP POLICY IF EXISTS "org_manage_gmail_thread_workspace" ON public.gmail_thread_workspace;

CREATE POLICY "org_read_gmail_thread_workspace"
  ON public.gmail_thread_workspace
  FOR SELECT
  USING (organization_id = public.get_org_id());

CREATE POLICY "org_manage_gmail_thread_workspace"
  ON public.gmail_thread_workspace
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager', 'sales_rep')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager', 'sales_rep')
  );
