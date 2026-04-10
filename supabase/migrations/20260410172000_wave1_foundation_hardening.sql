-- Wave 1 hardening: immutable audit + stronger write RLS + data quality constraints

-- ── 1) Make audit append-only (read + insert only) ────────────────────────────
DROP POLICY IF EXISTS "org_write_audit" ON public.audit_log;
DROP POLICY IF EXISTS "org_insert_audit" ON public.audit_log;
DROP POLICY IF EXISTS "org_update_audit" ON public.audit_log;
DROP POLICY IF EXISTS "org_delete_audit" ON public.audit_log;

CREATE POLICY "org_insert_audit"
  ON public.audit_log
  FOR INSERT
  WITH CHECK (organization_id = public.get_org_id());

-- ── 2) Restrict secondary table writes to manager/admin/owner ─────────────────
DROP POLICY IF EXISTS "org_write_products" ON public.products;
DROP POLICY IF EXISTS "org_write_templates" ON public.email_templates;
DROP POLICY IF EXISTS "org_write_goals" ON public.sales_goals;
DROP POLICY IF EXISTS "org_write_automations" ON public.automation_rules;
DROP POLICY IF EXISTS "org_write_sequences" ON public.email_sequences;
DROP POLICY IF EXISTS "org_write_enrollments" ON public.sequence_enrollments;
DROP POLICY IF EXISTS "org_write_cf_defs" ON public.custom_field_definitions;
DROP POLICY IF EXISTS "org_write_cf_values" ON public.custom_field_values;

CREATE POLICY "org_manage_products"
  ON public.products
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_templates"
  ON public.email_templates
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_goals"
  ON public.sales_goals
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_automations"
  ON public.automation_rules
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_sequences"
  ON public.email_sequences
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_enrollments"
  ON public.sequence_enrollments
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_cf_defs"
  ON public.custom_field_definitions
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

CREATE POLICY "org_manage_cf_values"
  ON public.custom_field_values
  FOR ALL
  USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  )
  WITH CHECK (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('owner', 'admin', 'manager')
  );

-- ── 3) Data quality constraints for core CRM tables ───────────────────────────
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_status_valid
  CHECK (status IN ('lead', 'prospect', 'customer', 'churned'));

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_source_valid
  CHECK (source IN ('website', 'referral', 'outbound', 'event', 'linkedin', 'other'));

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_email_unique_idx
  ON public.contacts (organization_id, lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';

ALTER TABLE public.deals
  ADD CONSTRAINT deals_stage_valid
  CHECK (stage IN ('lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'));

ALTER TABLE public.deals
  ADD CONSTRAINT deals_priority_valid
  CHECK (priority IN ('low', 'medium', 'high'));

ALTER TABLE public.deals
  ADD CONSTRAINT deals_probability_valid
  CHECK (probability BETWEEN 0 AND 100);

ALTER TABLE public.activities
  ADD CONSTRAINT activities_type_valid
  CHECK (type IN ('call', 'email', 'meeting', 'task', 'note', 'linkedin'));

ALTER TABLE public.activities
  ADD CONSTRAINT activities_status_valid
  CHECK (status IN ('pending', 'completed', 'cancelled'));
