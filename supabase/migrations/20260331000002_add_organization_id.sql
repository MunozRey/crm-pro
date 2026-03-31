-- Migration 002: Add organization_id to the 5 existing core CRM tables
-- Depends on: 20260331000001_create_org_tables.sql (organizations table must exist for FK)
-- Wave: 2 — runs after Plan 1.2 (migration 001)
-- Plan: 01.1

-- ─── Safety: truncate dev tables before NOT NULL ADD COLUMN ────────────────────
-- This project has no production data. Truncating is safer and simpler than backfilling.
-- PostgreSQL cannot add NOT NULL to a table that already has rows without a DEFAULT.
-- CASCADE drops dependent rows in other tables (e.g. activities that FK to contacts).
-- WARNING: Do NOT run this migration on any database with real user data.
TRUNCATE TABLE public.notifications CASCADE;
TRUNCATE TABLE public.activities   CASCADE;
TRUNCATE TABLE public.deals        CASCADE;
TRUNCATE TABLE public.contacts     CASCADE;
TRUNCATE TABLE public.companies    CASCADE;

-- ─── contacts ──────────────────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contacts_org_id
  ON public.contacts(organization_id);

-- ─── companies ─────────────────────────────────────────────────────────────────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_companies_org_id
  ON public.companies(organization_id);

-- ─── deals ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_deals_org_id
  ON public.deals(organization_id);

-- ─── activities ────────────────────────────────────────────────────────────────
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activities_org_id
  ON public.activities(organization_id);

-- ─── notifications ─────────────────────────────────────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id uuid NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_org_id
  ON public.notifications(organization_id);
