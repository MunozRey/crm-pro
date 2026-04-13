-- Safe helper to claim legacy tracking rows (user_id is null)
-- for the current authenticated user and current organization only.

CREATE OR REPLACE FUNCTION public.backfill_email_tracking_user(
  p_email_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid := public.get_org_id();
  v_message_count integer := 0;
  v_link_count integer := 0;
  v_event_count integer := 0;
BEGIN
  IF v_user_id IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Missing auth context';
  END IF;

  IF p_email_ids IS NULL OR array_length(p_email_ids, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'messages', 0,
      'links', 0,
      'events', 0
    );
  END IF;

  UPDATE public.email_tracking_messages
  SET user_id = v_user_id
  WHERE organization_id = v_org_id
    AND user_id IS NULL
    AND email_id = ANY(p_email_ids);
  GET DIAGNOSTICS v_message_count = ROW_COUNT;

  UPDATE public.email_tracking_links
  SET user_id = v_user_id
  WHERE organization_id = v_org_id
    AND user_id IS NULL
    AND email_id = ANY(p_email_ids);
  GET DIAGNOSTICS v_link_count = ROW_COUNT;

  UPDATE public.email_tracking_events
  SET user_id = v_user_id
  WHERE organization_id = v_org_id
    AND user_id IS NULL
    AND email_id = ANY(p_email_ids);
  GET DIAGNOSTICS v_event_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'messages', v_message_count,
    'links', v_link_count,
    'events', v_event_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_email_tracking_user(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_email_tracking_user(text[]) TO authenticated;
