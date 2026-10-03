-- Security hardening from the October 2026 review. Safe to re-run.
--
-- 1. Counters can only be changed by RevMate itself. Owners could set their
--    own post likes/comments, garage car likes/dislikes/followers (which
--    drive Rankings) and start a meet with any "going" number.
-- 2. Signed-out visitors (and Google) only see members known to be 18+,
--    matching public profile pages (0055). Signed-in members are unaffected.
-- 3. Only admins can add cars and common faults to the research pages (the
--    app never let members do this, but the database did).
-- 4. Instagram, Facebook and TikTok links must be https:// links, like the
--    newer social links (0052).
-- 5. Signed-out visitors can't ask whether an account is an admin.

BEGIN;

-- ============================================================
-- 1. COUNTERS
-- ============================================================
-- SECURITY INVOKER on purpose: current_user is the member for app requests,
-- and the function owner when RevMate's own counter triggers (SECURITY
-- DEFINER) update a count.
CREATE OR REPLACE FUNCTION private.guard_member_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'posts' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.likes_count := 0;
      NEW.comments_count := 0;
    ELSE
      NEW.likes_count := OLD.likes_count;
      NEW.comments_count := OLD.comments_count;
    END IF;
  ELSIF TG_TABLE_NAME = 'garage_cars' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.likes_count := 0;
      NEW.dislikes_count := 0;
      NEW.followers_count := 0;
      NEW.battle_wins := 0;
      NEW.battle_losses := 0;
    ELSE
      NEW.likes_count := OLD.likes_count;
      NEW.dislikes_count := OLD.dislikes_count;
      NEW.followers_count := OLD.followers_count;
    END IF;
  ELSIF TG_TABLE_NAME = 'car_meets' THEN
    NEW.going_count := 0;
    NEW.interested_count := 0;
    NEW.reminder_sent_at := NULL;
  ELSIF TG_TABLE_NAME = 'post_comments' THEN
    NEW.likes_count := 0;
  ELSIF TG_TABLE_NAME = 'stories' THEN
    NEW.views_count := 0;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_member_counters() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.guard_member_counters() TO anon, authenticated;

DROP TRIGGER IF EXISTS guard_member_counters ON public.posts;
CREATE TRIGGER guard_member_counters
BEFORE INSERT OR UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.guard_member_counters();

DROP TRIGGER IF EXISTS guard_member_counters ON public.garage_cars;
CREATE TRIGGER guard_member_counters
BEFORE INSERT OR UPDATE ON public.garage_cars
FOR EACH ROW EXECUTE FUNCTION private.guard_member_counters();

-- Meets and comments already protect their counters on update.
DROP TRIGGER IF EXISTS guard_member_counters ON public.car_meets;
CREATE TRIGGER guard_member_counters
BEFORE INSERT ON public.car_meets
FOR EACH ROW EXECUTE FUNCTION private.guard_member_counters();

DROP TRIGGER IF EXISTS guard_member_counters ON public.post_comments;
CREATE TRIGGER guard_member_counters
BEFORE INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION private.guard_member_counters();

DROP TRIGGER IF EXISTS guard_member_counters ON public.stories;
CREATE TRIGGER guard_member_counters
BEFORE INSERT ON public.stories
FOR EACH ROW EXECUTE FUNCTION private.guard_member_counters();

-- Put back the real numbers anywhere they were changed by hand. Only rows
-- that are wrong are touched.
SELECT set_config('revmate.counter_update', 'on', true);
SELECT set_config('revmate.meet_counter_update', 'on', true);

UPDATE public.posts p
SET likes_count = coalesce(l.n, 0)
FROM (SELECT p2.id, (SELECT count(*) FROM public.post_likes pl WHERE pl.post_id = p2.id) AS n
      FROM public.posts p2) l
WHERE l.id = p.id AND p.likes_count IS DISTINCT FROM coalesce(l.n, 0);

UPDATE public.posts p
SET comments_count = coalesce(c.n, 0)
FROM (SELECT p2.id, (SELECT count(*) FROM public.post_comments pc WHERE pc.post_id = p2.id) AS n
      FROM public.posts p2) c
WHERE c.id = p.id AND p.comments_count IS DISTINCT FROM coalesce(c.n, 0);

UPDATE public.garage_cars g
SET likes_count = x.likes, dislikes_count = x.dislikes, followers_count = x.followers
FROM (
  SELECT g2.id,
    (SELECT count(*) FROM public.garage_car_likes l WHERE l.garage_car_id = g2.id) AS likes,
    (SELECT count(*) FROM public.garage_car_dislikes d WHERE d.garage_car_id = g2.id) AS dislikes,
    (SELECT count(*) FROM public.garage_car_follows f WHERE f.garage_car_id = g2.id) AS followers
  FROM public.garage_cars g2
) x
WHERE x.id = g.id
  AND (g.likes_count, g.dislikes_count, g.followers_count)
      IS DISTINCT FROM (x.likes::int, x.dislikes::int, x.followers::int);

UPDATE public.car_meets m
SET going_count = x.going, interested_count = x.interested
FROM (
  SELECT m2.id,
    (SELECT count(*) FROM public.meet_attendees a WHERE a.meet_id = m2.id AND a.status = 'going') AS going,
    (SELECT count(*) FROM public.meet_attendees a WHERE a.meet_id = m2.id AND a.status = 'interested') AS interested
  FROM public.car_meets m2
) x
WHERE x.id = m.id
  AND (m.going_count, m.interested_count) IS DISTINCT FROM (x.going::int, x.interested::int);

SELECT set_config('revmate.counter_update', 'off', true);
SELECT set_config('revmate.meet_counter_update', 'off', true);

-- ============================================================
-- 2. SIGNED-OUT VISITORS ONLY SEE ADULTS
-- ============================================================
-- Unknown age counts as not an adult here, as on public profile pages.
CREATE OR REPLACE FUNCTION private.is_known_adult(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(private.account_age(uid) >= 18, false)
$$;
REVOKE ALL ON FUNCTION private.is_known_adult(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_known_adult(uuid) TO anon, authenticated;

-- RESTRICTIVE and only for anon: these narrow what signed-out visitors can
-- read and change nothing for signed-in members.
DROP POLICY IF EXISTS anon_adults_only ON public.profiles;
CREATE POLICY anon_adults_only ON public.profiles AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

DROP POLICY IF EXISTS anon_adults_only ON public.garage_cars;
CREATE POLICY anon_adults_only ON public.garage_cars AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

DROP POLICY IF EXISTS anon_adults_only ON public.garage_car_photos;
CREATE POLICY anon_adults_only ON public.garage_car_photos AS RESTRICTIVE FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.garage_cars g
    WHERE g.id = garage_car_photos.garage_car_id AND private.is_known_adult(g.user_id)
  ));

DROP POLICY IF EXISTS anon_adults_only ON public.garage_mods;
CREATE POLICY anon_adults_only ON public.garage_mods AS RESTRICTIVE FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.garage_cars g
    WHERE g.id = garage_mods.garage_car_id AND private.is_known_adult(g.user_id)
  ));

DROP POLICY IF EXISTS anon_adults_only ON public.posts;
CREATE POLICY anon_adults_only ON public.posts AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

DROP POLICY IF EXISTS anon_adults_only ON public.post_comments;
CREATE POLICY anon_adults_only ON public.post_comments AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

DROP POLICY IF EXISTS anon_adults_only ON public.stories;
CREATE POLICY anon_adults_only ON public.stories AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

DROP POLICY IF EXISTS anon_adults_only ON public.meet_attendees;
CREATE POLICY anon_adults_only ON public.meet_attendees AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

DROP POLICY IF EXISTS anon_adults_only ON public.profile_follows;
CREATE POLICY anon_adults_only ON public.profile_follows AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(follower_id) AND private.is_known_adult(followed_id));

-- ============================================================
-- 3. RESEARCH PAGES: ADMINS ONLY
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can add cars" ON public.cars;
CREATE POLICY "Authenticated users can add cars"
ON public.cars FOR INSERT TO authenticated
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Authenticated users can add faults" ON public.car_faults;
CREATE POLICY "Authenticated users can add faults"
ON public.car_faults FOR INSERT TO authenticated
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

-- ============================================================
-- 4. SOCIAL LINKS
-- ============================================================
-- NOT VALID: applies to every new save without failing on old values.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_instagram_https;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_instagram_https
  CHECK (social_instagram IS NULL OR (social_instagram LIKE 'https://%' AND char_length(social_instagram) <= 300)) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_facebook_https;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_facebook_https
  CHECK (social_facebook IS NULL OR (social_facebook LIKE 'https://%' AND char_length(social_facebook) <= 300)) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_tiktok_https;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_tiktok_https
  CHECK (social_tiktok IS NULL OR (social_tiktok LIKE 'https://%' AND char_length(social_tiktok) <= 300)) NOT VALID;

-- ============================================================
-- 5. ADMIN LOOKUP
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

COMMIT;
