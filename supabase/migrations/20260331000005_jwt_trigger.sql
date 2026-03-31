-- Migration 005: JWT claim trigger for organization membership
-- Depends on: 20260331000001_create_org_tables.sql (set_claim function, organization_members table)
-- Wave: 3 — parallel with migration 004 (RLS policies)
-- Plan: 01.5
-- Purpose: Automatically write organization_id and user_role into auth.users.raw_app_meta_data
--          when a user is added to or has their role changed in an organization.
--
-- IMPORTANT (Pitfall 3): After this trigger fires, the client MUST call
-- supabase.auth.refreshSession() to receive a new JWT containing the updated app_metadata.
-- The existing JWT is cached and will NOT reflect new claims until refreshed.

-- ─── handle_new_member function ────────────────────────────────────────────────
-- SECURITY DEFINER is required — the function writes to auth.users (auth schema)
-- which the calling role does not have direct write permission on.
CREATE OR REPLACE FUNCTION public.handle_new_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Write organization_id claim into JWT app_metadata
  PERFORM public.set_claim(
    NEW.user_id,
    'organization_id',
    to_jsonb(NEW.organization_id)
  );

  -- Write user_role claim into JWT app_metadata
  PERFORM public.set_claim(
    NEW.user_id,
    'user_role',
    to_jsonb(NEW.role)
  );

  RETURN NEW;
END;
$$;

-- ─── Trigger: on_org_member_created ────────────────────────────────────────────
-- Fires AFTER INSERT OR UPDATE so both new memberships AND role changes update the JWT.
DROP TRIGGER IF EXISTS on_org_member_created ON public.organization_members;

CREATE TRIGGER on_org_member_created
  AFTER INSERT OR UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_member();
