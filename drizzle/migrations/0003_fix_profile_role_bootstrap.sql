-- auth.uid() is NULL for anything that isn't a JWT-authenticated PostgREST
-- request (the SQL editor, migrations, service_role) — those callers already
-- bypass RLS entirely, so they're trusted by definition. Without this fix,
-- promoting the very first admin from the SQL editor was impossible, since
-- there's no logged-in user for is_admin() to check.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only an admin can change a profile role';
  END IF;
  RETURN NEW;
END;
$$;
