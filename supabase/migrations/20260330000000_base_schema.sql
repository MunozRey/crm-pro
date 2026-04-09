-- Migration 000: Base CRM schema — companies, contacts, deals, activities, notifications, gmail_tokens
-- Must run before all other migrations.

-- ─── Companies (no FKs to other CRM tables) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.companies (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  name          text        NOT NULL,
  industry      text,
  size          text,
  country       text,
  city          text,
  website       text,
  revenue       numeric,
  status        text        NOT NULL DEFAULT 'prospect',
  tags          text[]      NOT NULL DEFAULT '{}',
  notes         text,
  created_by    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  custom_fields jsonb       NOT NULL DEFAULT '{}'
);

-- ─── Contacts ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  first_name        text        NOT NULL,
  last_name         text        NOT NULL,
  email             text,
  phone             text,
  job_title         text,
  company_id        uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  status            text        NOT NULL DEFAULT 'prospect',
  source            text        NOT NULL DEFAULT 'other',
  score             integer     NOT NULL DEFAULT 50,
  tags              text[]      NOT NULL DEFAULT '{}',
  notes             text,
  assigned_to       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contacted_at timestamptz,
  custom_fields     jsonb       NOT NULL DEFAULT '{}'
);

-- ─── Deals ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deals (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  title               text        NOT NULL,
  value               numeric     NOT NULL DEFAULT 0,
  currency            text        NOT NULL DEFAULT 'eur',
  stage               text        NOT NULL DEFAULT 'lead',
  probability         integer     NOT NULL DEFAULT 10,
  expected_close_date date,
  contact_id          uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id          uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  assigned_to         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  priority            text        NOT NULL DEFAULT 'medium',
  source              text,
  notes               text,
  quote_items         jsonb       NOT NULL DEFAULT '[]',
  created_by          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  custom_fields       jsonb       NOT NULL DEFAULT '{}'
);

-- ─── Activities ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activities (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  type         text        NOT NULL,
  subject      text        NOT NULL,
  description  text,
  status       text        NOT NULL DEFAULT 'pending',
  deal_id      uuid        REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id   uuid        REFERENCES public.contacts(id) ON DELETE CASCADE,
  company_id   uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  due_date     timestamptz,
  completed_at timestamptz,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  outcome      text
);

-- ─── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  type        text        NOT NULL,
  title       text        NOT NULL,
  message     text        NOT NULL,
  entity_type text,
  entity_id   uuid,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  is_read     boolean     NOT NULL DEFAULT false
);

-- ─── Gmail Tokens ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gmail_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_address text        NOT NULL,
  refresh_token text        NOT NULL,
  access_token  text,
  token_expiry  timestamptz,
  scopes        text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ─── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── RLS (temp, replaced by migration 004) ─────────────────────────────────────
ALTER TABLE public.companies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_tokens  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_companies"  ON public.companies  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write_companies" ON public.companies  FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read_contacts"   ON public.contacts   FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write_contacts"  ON public.contacts   FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read_deals"      ON public.deals      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write_deals"     ON public.deals      FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_read_activities" ON public.activities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write_activities" ON public.activities FOR ALL   USING (auth.role() = 'authenticated');
CREATE POLICY "own_notifications"             ON public.notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_gmail_tokens"              ON public.gmail_tokens  FOR ALL USING (auth.uid() = user_id);
