-- Self-service organization creation via RPC (avoids edge-function gateway auth issues).
-- Intended for authenticated users without organization membership yet.

CREATE OR REPLACE FUNCTION public.create_org_self_service(
  p_org_name text,
  p_slug text
)
RETURNS TABLE (
  organization_id uuid,
  organization_name text,
  organization_domain text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_slug text;
  v_org_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_slug := lower(trim(p_slug));
  IF p_org_name IS NULL OR btrim(p_org_name) = '' THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;
  IF v_slug IS NULL OR v_slug = '' THEN
    RAISE EXCEPTION 'Slug is required';
  END IF;
  IF v_slug !~ '^[a-z0-9-]+$' THEN
    RAISE EXCEPTION 'Slug can only contain lowercase letters, numbers and hyphens';
  END IF;

  -- Block users that are already active members of any org.
  IF EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.user_id = v_user_id
      AND m.is_active = true
  ) THEN
    RAISE EXCEPTION 'User is already a member of an organization';
  END IF;

  -- Slug uniqueness check (canonicalized by lower()).
  IF EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE lower(o.domain) = v_slug
  ) THEN
    RAISE EXCEPTION 'This organization slug is already in use';
  END IF;

  INSERT INTO public.organizations (name, domain)
  VALUES (trim(p_org_name), v_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'admin');

  INSERT INTO public.organization_domains (organization_id, domain, is_verified)
  VALUES (v_org_id, v_slug, false)
  ON CONFLICT (domain) DO NOTHING;

  PERFORM public.set_claim(v_user_id, 'organization_id', to_jsonb(v_org_id));
  PERFORM public.set_claim(v_user_id, 'user_role', to_jsonb('admin'::text));

  RETURN QUERY
  SELECT v_org_id, trim(p_org_name), v_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.create_org_self_service(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_org_self_service(text, text) TO authenticated;
