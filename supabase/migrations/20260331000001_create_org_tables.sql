-- Migration 001: Create organizations, organization_members, invitations tables
--               and JWT claim helper functions (set_claim, get_org_id, get_user_role)
-- Wave: 1 — no dependencies; MUST run before any other Phase 1 migration
-- Plan: 01.2
-- Apply via: Supabase Dashboard > SQL Editor > Run

-- ─── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Helper functions ──────────────────────────────────────────────────────────
-- CRITICAL: define functions BEFORE any CREATE POLICY that calls them (Pitfall 5).

-- set_claim: writes a JSON value into auth.users.raw_app_meta_data
-- SECURITY DEFINER is REQUIRED — without it the function cannot write to the auth schema (Pitfall 6)
CREATE OR REPLACE FUNCTION public.set_claim(uid uuid, claim text, value jsonb)
RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE auth.users
  SET raw_app_meta_data =
    raw_app_meta_data ||
    json_build_object(claim, value)::jsonb
  WHERE id = uid
  RETURNING raw_app_meta_data::text;
$$;

-- get_org_id: reads organization_id from JWT app_metadata — O(1), no subquery
CREATE OR REPLACE FUNCTION public.get_org_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid,
    NULL
  );
$$;

-- get_user_role: reads user_role from JWT app_metadata
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    auth.jwt() -> 'app_metadata' ->> 'user_role',
    'viewer'
  );
$$;

-- ─── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text        NOT NULL,
  domain      text,
  logo_url    text,
  plan        text        NOT NULL DEFAULT 'free',
  max_users   integer     NOT NULL DEFAULT 5,
  settings    jsonb       NOT NULL DEFAULT '{}'
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_can_read_own_org" ON public.organizations
  FOR SELECT USING (
    id = public.get_org_id()
  );

CREATE POLICY "admins_can_update_org" ON public.organizations
  FOR UPDATE USING (
    id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner')
  );

-- ─── Organization Members ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'sales_rep',
  job_title       text,
  phone           text,
  avatar_url      text,
  is_active       boolean     NOT NULL DEFAULT true,
  invited_by      uuid        REFERENCES auth.users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_org_members_org_id
  ON public.organization_members(organization_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id
  ON public.organization_members(user_id);

CREATE POLICY "members_can_read_org_members" ON public.organization_members
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "admins_can_manage_members" ON public.organization_members
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );

-- ─── Invitations ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  role            text        NOT NULL DEFAULT 'sales_rep',
  token           text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid        NOT NULL REFERENCES auth.users(id),
  status          text        NOT NULL DEFAULT 'pending',
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invitations_org_id
  ON public.invitations(organization_id);

CREATE INDEX IF NOT EXISTS idx_invitations_token
  ON public.invitations(token);

CREATE POLICY "admins_can_manage_invitations" ON public.invitations
  FOR ALL USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );
