-- Hardening: fix "Function Search Path Mutable" warnings from Supabase Advisor.
-- Sets explicit search_path for security-sensitive helper/trigger functions.

ALTER FUNCTION public.handle_updated_at()
  SET search_path = public;

ALTER FUNCTION public.set_claim(uuid, text, jsonb)
  SET search_path = public, auth;

ALTER FUNCTION public.get_org_id()
  SET search_path = public;

ALTER FUNCTION public.get_user_role()
  SET search_path = public;

ALTER FUNCTION public.handle_new_member()
  SET search_path = public;
