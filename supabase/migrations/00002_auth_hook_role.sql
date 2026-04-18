-- Migration 00002: Custom Access Token Hook — inject role into JWT
-- Requires Supabase Pro (Auth Hooks feature)
-- After applying this migration, register the hook in:
--   Supabase Dashboard > Authentication > Hooks > Custom Access Token Hook
--   Set function: public.custom_access_token_hook

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims    JSONB;
  user_role TEXT;
BEGIN
  -- Fetch role from dashboard_profiles for this user
  SELECT role INTO user_role
  FROM public.dashboard_profiles
  WHERE id = (event->>'user_id')::UUID;

  -- If no profile found, return unmodified claims
  -- The app will catch this and trigger auto-signout
  IF user_role IS NULL THEN
    RETURN event;
  END IF;

  claims := event->'claims';

  -- Inject role into app_metadata inside the JWT
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    jsonb_build_object('role', user_role)
  );

  -- Return modified event
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to supabase_auth_admin (required for the hook to work)
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Revoke public access (security: only auth service should call this)
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
