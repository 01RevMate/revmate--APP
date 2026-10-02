-- RevMate SQL step 19 — public profile pages for adults (signed-out visitors + Google).
-- Copy of drizzle/migrations/0055_public_profiles.sql. Safe to run more than once.

-- Public profile pages: lets signed-out visitors and search engines see
-- adult members' profiles and garages (they're already visible to anyone
-- signed in). Under-18s, and accounts whose age we don't know yet, stay
-- behind the sign-in screen and out of Google. Additive only.

BEGIN;

-- Finds a profile from a link however it's typed: "@Jorderz", "Jorderz" or
-- "jorderz". Only returns adults with an active account.
CREATE INDEX IF NOT EXISTS profiles_username_ci_idx
  ON public.profiles (lower(ltrim(username, '@')));

CREATE OR REPLACE FUNCTION public.public_profile(target_username text)
RETURNS TABLE (user_id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.user_id, p.username
  FROM public.profiles p
  WHERE lower(ltrim(p.username, '@')) = lower(ltrim(btrim(target_username), '@'))
    AND p.account_status = 'active'
    AND coalesce(private.account_age(p.user_id) >= 18, false)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profile(text) TO anon, authenticated;

-- Public profiles for the sitemap (newest first).
CREATE OR REPLACE FUNCTION public.public_profile_handles(max_rows int DEFAULT 5000)
RETURNS TABLE (username text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.username, p.created_at
  FROM public.profiles p
  WHERE p.account_status = 'active'
    AND coalesce(private.account_age(p.user_id) >= 18, false)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(max_rows, 1), 10000);
$$;
REVOKE ALL ON FUNCTION public.public_profile_handles(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_profile_handles(int) TO anon, authenticated;

COMMIT;