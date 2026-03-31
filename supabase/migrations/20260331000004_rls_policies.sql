-- Migration 004: Replace blind RLS policies with org-scoped JWT claim policies
-- Depends on: 001 (get_org_id, get_user_role functions), 002 (organization_id columns)
-- Wave: 3 — parallel with migration 005 (JWT trigger); both depend on waves 1 and 2
-- Plan: 01.4
--
-- ANTI-PATTERN WARNING: Never use inline JWT cast in policies:
--   BAD:  (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
--   GOOD: public.get_org_id()
-- The helper function is O(1) and avoids duplication across 17 policy definitions.

-- ─── DROP old blind policies ────────────────────────────────────────────────────
-- contacts (from schema.sql: authenticated_read_contacts, authenticated_write_contacts)
DROP POLICY IF EXISTS "authenticated_read_contacts"  ON public.contacts;
DROP POLICY IF EXISTS "authenticated_write_contacts" ON public.contacts;

-- companies
DROP POLICY IF EXISTS "authenticated_read_companies"  ON public.companies;
DROP POLICY IF EXISTS "authenticated_write_companies" ON public.companies;

-- deals
DROP POLICY IF EXISTS "authenticated_read_deals"  ON public.deals;
DROP POLICY IF EXISTS "authenticated_write_deals" ON public.deals;

-- activities
DROP POLICY IF EXISTS "authenticated_read_activities"  ON public.activities;
DROP POLICY IF EXISTS "authenticated_write_activities" ON public.activities;

-- notifications (old policy — will be recreated with org scope added)
DROP POLICY IF EXISTS "own_notifications" ON public.notifications;

-- ─── contacts — 4 policies ─────────────────────────────────────────────────────
CREATE POLICY "org_members_can_read_contacts" ON public.contacts
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_update_contacts" ON public.contacts
  FOR UPDATE USING (organization_id = public.get_org_id());

CREATE POLICY "managers_can_delete_contacts" ON public.contacts
  FOR DELETE USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );

-- ─── companies — 4 policies ────────────────────────────────────────────────────
CREATE POLICY "org_members_can_read_companies" ON public.companies
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_insert_companies" ON public.companies
  FOR INSERT WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_update_companies" ON public.companies
  FOR UPDATE USING (organization_id = public.get_org_id());

CREATE POLICY "managers_can_delete_companies" ON public.companies
  FOR DELETE USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );

-- ─── deals — 4 policies ────────────────────────────────────────────────────────
CREATE POLICY "org_members_can_read_deals" ON public.deals
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_insert_deals" ON public.deals
  FOR INSERT WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_update_deals" ON public.deals
  FOR UPDATE USING (organization_id = public.get_org_id());

CREATE POLICY "managers_can_delete_deals" ON public.deals
  FOR DELETE USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );

-- ─── activities — 4 policies ───────────────────────────────────────────────────
CREATE POLICY "org_members_can_read_activities" ON public.activities
  FOR SELECT USING (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_insert_activities" ON public.activities
  FOR INSERT WITH CHECK (organization_id = public.get_org_id());

CREATE POLICY "org_members_can_update_activities" ON public.activities
  FOR UPDATE USING (organization_id = public.get_org_id());

CREATE POLICY "managers_can_delete_activities" ON public.activities
  FOR DELETE USING (
    organization_id = public.get_org_id()
    AND public.get_user_role() IN ('admin', 'owner', 'manager')
  );

-- ─── notifications — 1 combined policy ─────────────────────────────────────────
-- Notifications are personal (user_id) AND org-scoped (organization_id).
-- A user may only see their own notifications within their org.
CREATE POLICY "own_notifications" ON public.notifications
  FOR ALL USING (
    user_id = auth.uid()
    AND organization_id = public.get_org_id()
  );
