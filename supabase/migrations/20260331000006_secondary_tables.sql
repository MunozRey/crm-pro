-- Migration 006: Secondary feature tables
-- products, email_templates, sales_goals, automation_rules, audit_log,
-- email_sequences, sequence_enrollments, custom_field_definitions, custom_field_values

-- ─── Products ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  sku             text,
  price           numeric     NOT NULL DEFAULT 0,
  currency        text        NOT NULL DEFAULT 'eur',
  category        text        NOT NULL DEFAULT 'other',
  is_active       boolean     NOT NULL DEFAULT true
);

-- ─── Email Templates ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  subject         text        NOT NULL,
  body            text        NOT NULL,
  category        text        NOT NULL DEFAULT 'custom',
  variables       text[]      NOT NULL DEFAULT '{}',
  usage_count     integer     NOT NULL DEFAULT 0
);

-- ─── Sales Goals ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales_goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  type            text        NOT NULL,
  target          numeric     NOT NULL DEFAULT 0,
  current         numeric     NOT NULL DEFAULT 0,
  period          text        NOT NULL DEFAULT 'monthly',
  start_date      date        NOT NULL,
  end_date        date        NOT NULL
);

-- ─── Automation Rules ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  is_active       boolean     NOT NULL DEFAULT true,
  trigger         jsonb       NOT NULL DEFAULT '{}',
  actions         jsonb       NOT NULL DEFAULT '[]',
  execution_count integer     NOT NULL DEFAULT 0,
  last_executed_at timestamptz
);

-- ─── Audit Log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text        NOT NULL,
  entity_type     text        NOT NULL,
  entity_id       text        NOT NULL,
  entity_name     text        NOT NULL,
  details         text
);

-- ─── Email Sequences ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_sequences (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  description     text,
  steps           jsonb       NOT NULL DEFAULT '[]',
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  enrolled_count  integer     NOT NULL DEFAULT 0
);

-- ─── Sequence Enrollments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolled_at     timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sequence_id     uuid        NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name    text        NOT NULL,
  current_step    integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'active',
  next_step_at    timestamptz,
  completed_at    timestamptz
);

-- ─── Custom Field Definitions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type     text        NOT NULL,
  label           text        NOT NULL,
  field_type      text        NOT NULL DEFAULT 'text',
  placeholder     text,
  options         text[],
  required        boolean     NOT NULL DEFAULT false,
  "order"         integer     NOT NULL DEFAULT 0,
  is_active       boolean     NOT NULL DEFAULT true
);

-- ─── Custom Field Values ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  entity_id       text        NOT NULL,
  field_id        uuid        NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value           jsonb,
  PRIMARY KEY (entity_id, field_id)
);

-- ─── updated_at triggers ───────────────────────────────────────────────────────
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_sequences
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.products                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_goals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequences          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values      ENABLE ROW LEVEL SECURITY;

-- Org-scoped policies for all secondary tables
CREATE POLICY "org_read_products"   ON public.products   FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_products"  ON public.products   FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_templates"  ON public.email_templates  FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_templates" ON public.email_templates  FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_goals"      ON public.sales_goals      FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_goals"     ON public.sales_goals      FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_automations"  ON public.automation_rules  FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_automations" ON public.automation_rules  FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_audit"      ON public.audit_log        FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_audit"     ON public.audit_log        FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_sequences"  ON public.email_sequences       FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_sequences" ON public.email_sequences       FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_enrollments"  ON public.sequence_enrollments  FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_enrollments" ON public.sequence_enrollments  FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_cf_defs"    ON public.custom_field_definitions  FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_cf_defs"   ON public.custom_field_definitions  FOR ALL    USING (organization_id = public.get_org_id());

CREATE POLICY "org_read_cf_values"  ON public.custom_field_values  FOR SELECT USING (organization_id = public.get_org_id());
CREATE POLICY "org_write_cf_values" ON public.custom_field_values  FOR ALL    USING (organization_id = public.get_org_id());
