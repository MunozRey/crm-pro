-- Enforce per-user mailbox privacy for email tracking/workspace metadata.

ALTER TABLE public.email_tracking_messages
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.email_tracking_links
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.email_tracking_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_tracking_messages_user
  ON public.email_tracking_messages (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_tracking_links_user
  ON public.email_tracking_links (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_tracking_events_user
  ON public.email_tracking_events (user_id, created_at DESC);

DROP POLICY IF EXISTS "org_read_tracking_messages" ON public.email_tracking_messages;
DROP POLICY IF EXISTS "org_write_tracking_messages" ON public.email_tracking_messages;
CREATE POLICY "user_read_tracking_messages" ON public.email_tracking_messages
  FOR SELECT USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );
CREATE POLICY "user_write_tracking_messages" ON public.email_tracking_messages
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "org_read_tracking_links" ON public.email_tracking_links;
DROP POLICY IF EXISTS "org_write_tracking_links" ON public.email_tracking_links;
CREATE POLICY "user_read_tracking_links" ON public.email_tracking_links
  FOR SELECT USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );
CREATE POLICY "user_write_tracking_links" ON public.email_tracking_links
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "org_read_tracking_events" ON public.email_tracking_events;
DROP POLICY IF EXISTS "org_write_tracking_events" ON public.email_tracking_events;
CREATE POLICY "user_read_tracking_events" ON public.email_tracking_events
  FOR SELECT USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );
CREATE POLICY "user_write_tracking_events" ON public.email_tracking_events
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "org_read_gmail_thread_workspace" ON public.gmail_thread_workspace;
DROP POLICY IF EXISTS "org_manage_gmail_thread_workspace" ON public.gmail_thread_workspace;
CREATE POLICY "user_read_gmail_thread_workspace"
  ON public.gmail_thread_workspace
  FOR SELECT
  USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );
CREATE POLICY "user_manage_gmail_thread_workspace"
  ON public.gmail_thread_workspace
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND user_id = auth.uid()
  );
