-- Launch kit: an in-app feedback box, a private launch-stats summary for
-- admins, and Founding member badges for the first 100 people to join.
-- Additive and safe to re-run.

BEGIN;

-- ---------- Feedback ----------
-- Members send bugs and ideas from the app. Only admins can read them.

CREATE TABLE IF NOT EXISTS public.app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'idea' CHECK (kind IN ('bug', 'idea', 'other')),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 3 AND 2000),
  page text CHECK (page IS NULL OR char_length(page) <= 200),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_feedback_created_idx ON public.app_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS app_feedback_user_idx ON public.app_feedback (user_id, created_at DESC);

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_feedback FROM anon, authenticated;
GRANT INSERT (kind, message, page) ON public.app_feedback TO authenticated;
GRANT SELECT, DELETE ON public.app_feedback TO authenticated;
GRANT UPDATE (status) ON public.app_feedback TO authenticated;

DROP POLICY IF EXISTS app_feedback_insert ON public.app_feedback;
CREATE POLICY app_feedback_insert ON public.app_feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'new');

DROP POLICY IF EXISTS app_feedback_admin_read ON public.app_feedback;
CREATE POLICY app_feedback_admin_read ON public.app_feedback FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS app_feedback_admin_update ON public.app_feedback;
CREATE POLICY app_feedback_admin_update ON public.app_feedback FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS app_feedback_admin_delete ON public.app_feedback;
CREATE POLICY app_feedback_admin_delete ON public.app_feedback FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- At most 10 a day per person, so the box can't be used to flood admins.
CREATE OR REPLACE FUNCTION private.limit_app_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.app_feedback
    WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day'
  ) >= 10 THEN
    RAISE EXCEPTION 'You''ve sent a lot of feedback today. Thanks! Try again tomorrow.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.limit_app_feedback() FROM PUBLIC;

DROP TRIGGER IF EXISTS app_feedback_limit ON public.app_feedback;
CREATE TRIGGER app_feedback_limit BEFORE INSERT ON public.app_feedback
  FOR EACH ROW EXECUTE FUNCTION private.limit_app_feedback();

-- ---------- Founding members ----------
-- The first 100 accounts get a numbered badge. Numbers are handed out once,
-- in sign-up order, and never move (deleting an account frees no spot).

CREATE TABLE IF NOT EXISTS public.founding_members (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  number int NOT NULL UNIQUE CHECK (number BETWEEN 1 AND 100),
  joined_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.founding_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.founding_members FROM anon, authenticated;
GRANT SELECT ON public.founding_members TO anon, authenticated;

DROP POLICY IF EXISTS founding_members_read ON public.founding_members;
CREATE POLICY founding_members_read ON public.founding_members FOR SELECT
  TO anon, authenticated USING (true);

-- Same rule as profiles: signed-out visitors only see adults.
DROP POLICY IF EXISTS anon_adults_only ON public.founding_members;
CREATE POLICY anon_adults_only ON public.founding_members AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

-- Tracks the highest number handed out, so freed rows never reopen a spot.
CREATE TABLE IF NOT EXISTS private.founding_counter (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  last_number int NOT NULL DEFAULT 0
);
INSERT INTO private.founding_counter (id, last_number)
  VALUES (true, 0) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.claim_founding_spot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_number int;
BEGIN
  UPDATE private.founding_counter
    SET last_number = last_number + 1
    WHERE id AND last_number < 100
    RETURNING last_number INTO next_number;
  IF next_number IS NOT NULL THEN
    INSERT INTO public.founding_members (user_id, number)
      VALUES (NEW.user_id, next_number)
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.claim_founding_spot() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_founding_spot ON public.profiles;
CREATE TRIGGER profiles_founding_spot AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.claim_founding_spot();

-- Backfill: everyone who joined before this ran, oldest first, until the 100
-- are gone. Only runs while nobody has a number yet, so re-running is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.founding_members) THEN
    INSERT INTO public.founding_members (user_id, number, joined_at)
    SELECT user_id, row_number() OVER (ORDER BY created_at, id), created_at
    FROM public.profiles
    ORDER BY created_at, id
    LIMIT 100;
    UPDATE private.founding_counter
      SET last_number = (SELECT coalesce(max(number), 0) FROM public.founding_members);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.founding_spots_left()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT greatest(0, 100 - last_number) FROM private.founding_counter WHERE id
$$;
REVOKE ALL ON FUNCTION public.founding_spots_left() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.founding_spots_left() TO anon, authenticated;

-- ---------- Launch stats (admins only) ----------
-- Counts only: no names, emails or locations.

CREATE OR REPLACE FUNCTION public.admin_launch_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'members', (SELECT count(*) FROM public.profiles),
    'joined_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'joined_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'joined_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'active_today', (SELECT count(*) FROM public.profiles WHERE last_active_on >= current_date),
    'active_7d', (SELECT count(*) FROM public.profiles WHERE last_active_on > current_date - 7),
    'posts_7d', (SELECT count(*) FROM public.posts WHERE created_at > now() - interval '7 days'),
    'listings_7d', (SELECT count(*) FROM public.listings WHERE created_at > now() - interval '7 days'),
    'messages_7d', (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '7 days'),
    'feedback_new', (SELECT count(*) FROM public.app_feedback WHERE status = 'new'),
    'founding_left', public.founding_spots_left()
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_launch_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_launch_stats() TO authenticated;

COMMIT;
