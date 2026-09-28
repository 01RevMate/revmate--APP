-- Age checks, sign-up consent records and account deletion.
-- Run after 0036_group_rules.sql.
--
-- * account_consents stores each person's date of birth (private — only
--   they can read it), which version of the Terms and Privacy Policy they
--   agreed to and when, and their marketing opt-in (off unless ticked).
-- * Sign-ups under 13 are refused by the database, not just the app.
-- * Age limits (enforced here so they can't be bypassed):
--     - 18+: selling on Buy & Sell, hosting car meets, adding a location to
--       posts
--     - 16+: direct messages (both people must be 16+)
--   Accounts made before this update have no date of birth yet; the app asks
--   them for it, and until then they keep working as before.
-- * delete_my_account() permanently deletes the signed-in person's account
--   and everything attached to it (UK GDPR right to erasure). Groups they
--   own pass to their most senior member, or are deleted if empty.

BEGIN;

CREATE TABLE IF NOT EXISTS public.account_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  birth_date date CHECK (birth_date >= DATE '1900-01-01'),
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_consents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_consents TO authenticated;
GRANT ALL ON public.account_consents TO service_role;
DROP POLICY IF EXISTS account_consents_own ON public.account_consents;
CREATE POLICY account_consents_own ON public.account_consents FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- AGE HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION private.london_today() RETURNS date
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'Europe/London')::date
$$;

CREATE OR REPLACE FUNCTION private.account_age(uid uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT extract(year FROM age(private.london_today(), birth_date))::integer
  FROM public.account_consents WHERE user_id = uid AND birth_date IS NOT NULL
$$;

-- Unknown age (accounts from before this update) is allowed until they
-- tell us; the app asks them straight away.
CREATE OR REPLACE FUNCTION private.age_at_least(uid uuid, years integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(private.account_age(uid) >= years, true)
$$;
REVOKE ALL ON FUNCTION private.account_age(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.age_at_least(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.age_at_least(uuid, integer) TO authenticated;

-- ============================================================
-- SIGN-UP
-- ============================================================
-- The sign-up form sends birth_date, terms_version, privacy_version and
-- marketing_opt_in in the new user's metadata.
CREATE OR REPLACE FUNCTION private.record_signup_consents() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  born date;
BEGIN
  IF nullif(meta ->> 'birth_date', '') IS NULL THEN RETURN NEW; END IF;
  BEGIN
    born := (meta ->> 'birth_date')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Enter a valid date of birth';
  END;
  IF born < DATE '1900-01-01' OR born > private.london_today() THEN
    RAISE EXCEPTION 'Enter a valid date of birth';
  END IF;
  IF extract(year FROM age(private.london_today(), born)) < 13 THEN
    RAISE EXCEPTION 'You must be 13 or older to join RevMate';
  END IF;
  INSERT INTO public.account_consents (
    user_id, birth_date, terms_version, terms_accepted_at, privacy_version,
    marketing_opt_in, marketing_updated_at
  ) VALUES (
    NEW.id, born,
    nullif(meta ->> 'terms_version', ''),
    CASE WHEN nullif(meta ->> 'terms_version', '') IS NOT NULL THEN now() END,
    nullif(meta ->> 'privacy_version', ''),
    coalesce((meta ->> 'marketing_opt_in')::boolean, false),
    now()
  ) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created_consents ON auth.users;
CREATE TRIGGER on_auth_user_created_consents AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.record_signup_consents();

-- People who used the new sign-up before this file ran already have these
-- details on their account; copy them across so they aren't asked again.
INSERT INTO public.account_consents (
  user_id, birth_date, terms_version, terms_accepted_at, privacy_version,
  marketing_opt_in, marketing_updated_at
)
SELECT u.id,
  (u.raw_user_meta_data ->> 'birth_date')::date,
  nullif(u.raw_user_meta_data ->> 'terms_version', ''),
  CASE WHEN nullif(u.raw_user_meta_data ->> 'terms_version', '') IS NOT NULL THEN u.created_at END,
  nullif(u.raw_user_meta_data ->> 'privacy_version', ''),
  coalesce((u.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
  u.created_at
FROM auth.users u
WHERE u.raw_user_meta_data ->> 'birth_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  AND (u.raw_user_meta_data ->> 'birth_date')::date BETWEEN DATE '1900-01-01' AND private.london_today()
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- ACCOUNT DELETION
-- ============================================================
CREATE OR REPLACE FUNCTION private.delete_account(uid uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  g record;
  heir uuid;
  other_admin uuid;
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);

  -- Groups they own pass to their most senior member, or go if empty.
  FOR g IN SELECT id FROM public.community_groups WHERE owner_id = uid LOOP
    SELECT user_id INTO heir FROM public.group_members
    WHERE group_id = g.id AND user_id <> uid AND status = 'approved'
    ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END, requested_at
    LIMIT 1;
    IF heir IS NULL THEN
      DELETE FROM public.community_groups WHERE id = g.id;
    ELSE
      UPDATE public.community_groups SET owner_id = heir WHERE id = g.id;
      UPDATE public.group_members SET role = 'owner' WHERE group_id = g.id AND user_id = heir;
    END IF;
  END LOOP;

  -- Protected terms an admin added stay, credited to another admin.
  IF EXISTS (SELECT 1 FROM public.protected_post_terms WHERE created_by = uid) THEN
    SELECT user_id INTO other_admin FROM public.profiles
    WHERE role = 'admin' AND user_id <> uid ORDER BY created_at LIMIT 1;
    IF other_admin IS NULL THEN
      RAISE EXCEPTION 'Make someone else an admin before deleting the last admin account';
    END IF;
    UPDATE public.protected_post_terms SET created_by = other_admin WHERE created_by = uid;
  END IF;

  -- These older tables aren't linked to profiles, so clear them directly.
  DELETE FROM public.answers WHERE user_id = uid;
  DELETE FROM public.questions WHERE user_id = uid;
  DELETE FROM public.listings WHERE user_id = uid;
  DELETE FROM public.saved_cars WHERE user_id = uid;

  DELETE FROM public.profiles WHERE user_id = uid;
  DELETE FROM auth.users WHERE id = uid;
END; $$;
REVOKE ALL ON FUNCTION private.delete_account(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_account() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in to delete your account'; END IF;
  PERFORM private.delete_account(actor);
END; $$;

-- For accounts made before sign-up asked for these. Date of birth can only
-- be set once. Returns 'under_age' (and deletes the account) for under-13s.
CREATE OR REPLACE FUNCTION public.record_consents(
  born date, terms_version text, privacy_version text, marketing boolean DEFAULT false
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  existing date;
BEGIN
  IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = actor) THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  IF nullif(btrim(terms_version), '') IS NULL OR nullif(btrim(privacy_version), '') IS NULL THEN
    RAISE EXCEPTION 'Agree to the Terms and Privacy Policy to continue';
  END IF;
  SELECT birth_date INTO existing FROM public.account_consents WHERE user_id = actor;
  born := coalesce(existing, born);
  IF born IS NULL OR born < DATE '1900-01-01' OR born > private.london_today() THEN
    RAISE EXCEPTION 'Enter a valid date of birth';
  END IF;
  IF extract(year FROM age(private.london_today(), born)) < 13 THEN
    PERFORM private.delete_account(actor);
    RETURN 'under_age';
  END IF;
  INSERT INTO public.account_consents AS c (
    user_id, birth_date, terms_version, terms_accepted_at, privacy_version,
    marketing_opt_in, marketing_updated_at
  ) VALUES (actor, born, terms_version, now(), privacy_version, coalesce(marketing, false), now())
  ON CONFLICT (user_id) DO UPDATE SET
    birth_date = coalesce(c.birth_date, EXCLUDED.birth_date),
    terms_version = EXCLUDED.terms_version,
    terms_accepted_at = now(),
    privacy_version = EXCLUDED.privacy_version,
    marketing_opt_in = EXCLUDED.marketing_opt_in,
    marketing_updated_at = CASE WHEN c.marketing_opt_in IS DISTINCT FROM EXCLUDED.marketing_opt_in
      THEN now() ELSE c.marketing_updated_at END,
    updated_at = now();
  RETURN 'ok';
END; $$;

CREATE OR REPLACE FUNCTION public.set_marketing_consent(opt_in boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  INSERT INTO public.account_consents (user_id, marketing_opt_in, marketing_updated_at)
  VALUES (actor, coalesce(opt_in, false), now())
  ON CONFLICT (user_id) DO UPDATE
    SET marketing_opt_in = EXCLUDED.marketing_opt_in, marketing_updated_at = now(), updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.delete_my_account(), public.record_consents(date, text, text, boolean),
  public.set_marketing_consent(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(), public.record_consents(date, text, text, boolean),
  public.set_marketing_consent(boolean) TO authenticated;

-- ============================================================
-- AGE LIMITS
-- ============================================================
DROP POLICY IF EXISTS listings_adults_only ON public.listings;
CREATE POLICY listings_adults_only ON public.listings AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.age_at_least((SELECT auth.uid()), 18));

DROP POLICY IF EXISTS car_meets_adults_only ON public.car_meets;
CREATE POLICY car_meets_adults_only ON public.car_meets AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.age_at_least((SELECT auth.uid()), 18));

DROP POLICY IF EXISTS posts_location_adults_only ON public.posts;
CREATE POLICY posts_location_adults_only ON public.posts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (latitude IS NULL OR private.age_at_least((SELECT auth.uid()), 18));

DROP POLICY IF EXISTS conversations_16_plus ON public.conversations;
CREATE POLICY conversations_16_plus ON public.conversations AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (private.age_at_least(user_a, 16) AND private.age_at_least(user_b, 16));

DROP POLICY IF EXISTS messages_16_plus ON public.messages;
CREATE POLICY messages_16_plus ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND private.age_at_least(c.user_a, 16) AND private.age_at_least(c.user_b, 16)
  ));

COMMIT;
