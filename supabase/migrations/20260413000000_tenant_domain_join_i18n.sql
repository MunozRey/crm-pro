-- Multi-tenant onboarding + custom fields i18n
-- Adds:
--   1) organization_domains
--   2) organization_join_requests
--   3) custom_field_definition_i18n

-- ─── organization_domains ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain)
);

CREATE INDEX IF NOT EXISTS idx_org_domains_org_id
  ON public.organization_domains (organization_id);

CREATE INDEX IF NOT EXISTS idx_org_domains_domain
  ON public.organization_domains (lower(domain));

ALTER TABLE public.organization_domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_domains" ON public.organization_domains;
CREATE POLICY "org_read_domains" ON public.organization_domains
  FOR SELECT
  USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_admin_write_domains" ON public.organization_domains;
CREATE POLICY "org_admin_write_domains" ON public.organization_domains
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner')
  );

DROP TRIGGER IF EXISTS set_updated_at ON public.organization_domains;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organization_domains
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Backfill domains from organizations.domain for old rows.
INSERT INTO public.organization_domains (organization_id, domain, is_verified)
SELECT o.id, lower(o.domain), true
FROM public.organizations o
WHERE o.domain IS NOT NULL
ON CONFLICT (domain) DO NOTHING;

-- Keep organizations.domain unique/indexed for compatibility paths.
CREATE UNIQUE INDEX IF NOT EXISTS organizations_domain_unique_idx
  ON public.organizations (lower(domain))
  WHERE domain IS NOT NULL;

-- ─── organization_join_requests ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  CONSTRAINT org_join_requests_status_chk CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_join_requests_org_status
  ON public.organization_join_requests (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_join_requests_email
  ON public.organization_join_requests (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS org_join_requests_unique_pending
  ON public.organization_join_requests (organization_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_read_join_requests" ON public.organization_join_requests;
CREATE POLICY "org_members_read_join_requests" ON public.organization_join_requests
  FOR SELECT
  USING (
    organization_id = public.get_org_id()
    OR auth.uid() = user_id
  );

DROP POLICY IF EXISTS "org_admin_manage_join_requests" ON public.organization_join_requests;
CREATE POLICY "org_admin_manage_join_requests" ON public.organization_join_requests
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );

-- ─── custom_field_definition_i18n ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_field_definition_i18n (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  language_code text NOT NULL,
  label text NOT NULL,
  placeholder text,
  options text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_field_i18n_language_chk CHECK (language_code IN ('en', 'es', 'pt', 'fr', 'de', 'it')),
  UNIQUE (field_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_custom_field_i18n_org_lang
  ON public.custom_field_definition_i18n (organization_id, language_code);

ALTER TABLE public.custom_field_definition_i18n ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_read_cf_i18n" ON public.custom_field_definition_i18n;
CREATE POLICY "org_read_cf_i18n" ON public.custom_field_definition_i18n
  FOR SELECT
  USING (organization_id = public.get_org_id());

DROP POLICY IF EXISTS "org_write_cf_i18n" ON public.custom_field_definition_i18n;
CREATE POLICY "org_write_cf_i18n" ON public.custom_field_definition_i18n
  FOR ALL
  USING (organization_id = public.get_org_id())
  WITH CHECK (organization_id = public.get_org_id());

DROP TRIGGER IF EXISTS set_updated_at ON public.custom_field_definition_i18n;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.custom_field_definition_i18n
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
