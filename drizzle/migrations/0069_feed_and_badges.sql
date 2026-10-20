-- Hooks: a feed that's fresh every time you open the app, and badges to
-- collect.
--
--   * post_impressions: which feed posts you've already scrolled past (kept
--     30 days, only ever visible to the database). The For You feed sinks
--     posts you've seen, boosts posts taking off right now, gives new members'
--     first posts a stage and stops one account flooding the feed.
--   * user_badges: achievements (first post, crowd pleaser, 7-day streak,
--     meet regular, Car of the Week…). award_my_badges() runs when you open
--     the app and sends a notification for each new badge.
--
-- Needs 0067_store.sql (the 'badge' notification kind). Safe to re-run.

BEGIN;

-- ---------- Seen posts ----------
CREATE TABLE IF NOT EXISTS public.post_impressions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS post_impressions_recent_idx ON public.post_impressions (user_id, seen_at DESC);
ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.post_impressions FROM PUBLIC, anon, authenticated;
-- The feed runs as the viewer, so they may read their own rows (visitors
-- have none, but the feed still needs to be able to look).
GRANT SELECT ON public.post_impressions TO anon, authenticated;
GRANT ALL ON public.post_impressions TO service_role;
DROP POLICY IF EXISTS post_impressions_own ON public.post_impressions;
CREATE POLICY post_impressions_own ON public.post_impressions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.record_post_impressions(post_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR post_ids IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.post_impressions (user_id, post_id, seen_at)
  SELECT me, p.id, now()
  FROM public.posts p
  WHERE p.id = ANY (post_ids[1:50])
  ON CONFLICT (user_id, post_id) DO UPDATE SET seen_at = now();
  -- Keep it small: forget anything older than 30 days.
  DELETE FROM public.post_impressions WHERE user_id = me AND seen_at < now() - interval '30 days';
END;
$$;
REVOKE ALL ON FUNCTION public.record_post_impressions(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_post_impressions(uuid[]) TO authenticated;

CREATE INDEX IF NOT EXISTS post_likes_recent_idx ON public.post_likes (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_author_published_idx ON public.posts (user_id) WHERE moderation_status = 'published';

-- ---------- For You feed v3 ----------
CREATE OR REPLACE FUNCTION public.for_you_feed(page_offset integer DEFAULT 0, filter_category text DEFAULT 'all')
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH viewer AS (SELECT (SELECT auth.uid()) AS id),
  my_cars AS (
    SELECT lower(btrim(g.make)) AS make, g.fuel_type::text AS fuel,
      (SELECT count(*) FROM public.garage_mods m WHERE m.garage_car_id = g.id) AS mods
    FROM public.garage_cars g, viewer
    WHERE g.user_id = viewer.id AND g.ownership_status = 'current'
  ),
  my_makes AS (
    SELECT make FROM my_cars
    UNION
    SELECT lower(btrim(m)) FROM public.profiles pr, viewer, unnest(pr.favourite_makes) AS m
    WHERE pr.user_id = viewer.id
  ),
  taste AS (
    SELECT
      (SELECT round(avg(private.segment_rank(s.segment))) FROM my_makes mm
        JOIN public.vehicle_make_segments s ON s.make = mm.make) AS tier,
      (SELECT bool_or(fuel = 'electric') FROM my_cars) AS drives_ev,
      (SELECT pr.persona::text FROM public.profiles pr, viewer WHERE pr.user_id = viewer.id) AS persona,
      (SELECT coalesce(sum(mods), 0) FROM my_cars) AS my_mods
  ),
  liked_categories AS (
    SELECT p.category::text AS category, count(*) AS n
    FROM public.post_likes l JOIN public.posts p ON p.id = l.post_id, viewer
    WHERE l.user_id = viewer.id AND l.created_at > now() - interval '60 days'
    GROUP BY p.category
  ),
  liked_authors AS (
    SELECT p.user_id, count(*) AS n
    FROM public.post_likes l JOIN public.posts p ON p.id = l.post_id, viewer
    WHERE l.user_id = viewer.id AND l.created_at > now() - interval '60 days'
    GROUP BY p.user_id
  ),
  seen AS (
    SELECT i.post_id, i.seen_at
    FROM public.post_impressions i, viewer
    WHERE i.user_id = viewer.id AND i.seen_at > now() - interval '7 days'
  ),
  scored AS (
  SELECT p AS post, p.user_id AS author, p.created_at AS created, p.id AS pid, (
      ln(1 + p.likes_count + 2 * p.comments_count + 3 * p.reposts_count
        + coalesce(g.likes_count, 0) * 0.5)
      + CASE WHEN viewer.id IS NOT NULL AND private.is_following(viewer.id, p.user_id) THEN 2.5 ELSE 0 END
      + CASE WHEN lower(btrim(coalesce(p.tagged_make, g.make, c.make, ''))) IN (SELECT make FROM my_makes) THEN 2 ELSE 0 END
      + ln(1 + coalesce(la.n, 0))
      -- Same kind of car: closer brand tiers score higher, far-apart ones lower.
      + CASE
          WHEN taste.tier IS NULL OR seg.segment IS NULL THEN 0
          WHEN abs(private.segment_rank(seg.segment) - taste.tier) = 0 THEN 1.5
          WHEN abs(private.segment_rank(seg.segment) - taste.tier) = 1 THEN 0.5
          ELSE -1
        END
      -- EV drivers see more electric cars.
      + CASE WHEN coalesce(taste.drives_ev, false) AND g.fuel_type::text = 'electric' THEN 1.5 ELSE 0 END
      -- Modified-car content for people into mods; less of it for owners who aren't.
      + CASE
          WHEN p.category::text <> 'modifications' THEN 0
          WHEN taste.persona IN ('modifier', 'enthusiast') OR taste.my_mods > 0 THEN 1
          WHEN taste.persona IN ('owner', 'trader') OR taste.tier >= 3 THEN -1.5
          ELSE 0
        END
      -- Practical owners get more of the useful stuff.
      + CASE WHEN taste.persona IN ('owner', 'diy_mechanic')
               AND p.category::text IN ('diagnostics', 'maintenance') THEN 1 ELSE 0 END
      -- Solved problems are worth surfacing.
      + CASE WHEN p.issue_status = 'resolved' THEN 0.5 ELSE 0 END
      + 0.5 * ln(1 + coalesce(lc.n, 0))
      - CASE WHEN p.user_id = viewer.id THEN 1 ELSE 0 END
      - extract(epoch FROM now() - p.created_at) / 43200.0
      -- Fresh every time you open the app: posts you've already scrolled past sink.
      - CASE WHEN s.seen_at > now() - interval '1 day' THEN 4
             WHEN s.seen_at IS NOT NULL THEN 2 ELSE 0 END
      -- Taking off right now (likes in the last 6 hours).
      + 0.8 * ln(1 + recent.n)
      -- Give new members' first posts a stage, so their first likes come quickly.
      + CASE WHEN author_posts.n <= 5 AND p.created_at > now() - interval '24 hours'
               AND p.user_id IS DISTINCT FROM viewer.id THEN 1.5 ELSE 0 END
      -- A chance for brand-new posts nobody has reacted to yet.
      + CASE WHEN p.likes_count = 0 AND p.created_at > now() - interval '3 hours' THEN 0.5 ELSE 0 END
    ) AS score
  FROM public.posts p
  CROSS JOIN viewer
  CROSS JOIN taste
  LEFT JOIN public.garage_cars g ON g.id = p.posted_as_garage_car_id
  LEFT JOIN public.cars c ON c.id = p.car_id
  LEFT JOIN public.vehicle_make_segments seg
    ON seg.make = lower(btrim(coalesce(p.tagged_make, g.make, c.make, '')))
  LEFT JOIN liked_authors la ON la.user_id = p.user_id
  LEFT JOIN liked_categories lc ON lc.category = p.category::text
  LEFT JOIN seen s ON s.post_id = p.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.post_likes pl
    WHERE pl.post_id = p.id AND pl.created_at > now() - interval '6 hours'
  ) recent ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS n FROM public.posts ap
    WHERE ap.user_id = p.user_id AND ap.moderation_status = 'published'
  ) author_posts ON true
  WHERE p.moderation_status = 'published'
    AND p.group_id IS NULL
    AND p.created_at > now() - interval '45 days'
    AND (filter_category = 'all' OR p.category::text = filter_category)
    AND (
      p.audience = 'public'
      OR (viewer.id IS NOT NULL AND (p.user_id = viewer.id OR private.is_following(viewer.id, p.user_id)))
    )
  ),
  ranked AS (
    -- At most one post per person near the top: each extra post from the same
    -- author drops a little, so one account can't flood your feed.
    SELECT post, created, pid,
      score - 1.5 * (row_number() OVER (PARTITION BY author ORDER BY score DESC) - 1) AS final
    FROM scored
  )
  SELECT (post).*
  FROM ranked
  ORDER BY final DESC, created DESC, pid DESC
  LIMIT 30 OFFSET greatest(0, least(page_offset, 10000));
$$;
GRANT EXECUTE ON FUNCTION public.for_you_feed(integer, text) TO anon, authenticated;

-- ---------- Badges ----------
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge text NOT NULL CHECK (badge ~ '^[a-z0-9_]{1,40}$'),
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_badges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_badges TO anon, authenticated;
GRANT ALL ON public.user_badges TO service_role;
DROP POLICY IF EXISTS user_badges_read ON public.user_badges;
CREATE POLICY user_badges_read ON public.user_badges FOR SELECT USING (true);
DROP POLICY IF EXISTS anon_adults_only ON public.user_badges;
CREATE POLICY anon_adults_only ON public.user_badges AS RESTRICTIVE FOR SELECT TO anon
  USING (private.is_known_adult(user_id));

-- Checks every badge for the signed-in member, awards new ones with a
-- notification, and returns the codes of any just earned.
CREATE OR REPLACE FUNCTION public.award_my_badges()
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  earned text[] := '{}';
  candidate record;
  posts_n int;
  likes_n bigint;
  car_likes int;
  streak int;
  meets_n int;
  helpful_n int;
  listings_n int;
  cars_n int;
BEGIN
  IF me IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = me) THEN
    RETURN earned;
  END IF;
  SELECT count(*) INTO posts_n FROM public.posts WHERE user_id = me AND moderation_status = 'published';
  SELECT coalesce(sum(likes_count), 0) INTO likes_n FROM public.posts WHERE user_id = me;
  SELECT coalesce(max(likes_count), 0) INTO car_likes FROM public.garage_cars WHERE user_id = me;
  SELECT count(*) INTO cars_n FROM public.garage_cars WHERE user_id = me;
  SELECT coalesce(longest_streak, 0) INTO streak FROM public.profiles WHERE user_id = me;
  SELECT count(*) INTO meets_n FROM public.meet_attendees WHERE user_id = me AND status = 'going';
  SELECT count(*) INTO helpful_n FROM public.post_comments c JOIN public.posts p ON p.id = c.post_id
    WHERE c.user_id = me AND p.user_id <> me AND p.issue_status IS NOT NULL;
  SELECT count(*) INTO listings_n FROM public.listings WHERE user_id = me;

  FOR candidate IN
    SELECT * FROM (VALUES
      ('first_post', posts_n >= 1, 'First post'),
      ('regular', posts_n >= 25, 'Regular'),
      ('garage_started', cars_n >= 1, 'Garage started'),
      ('crowd_pleaser', likes_n >= 50, 'Crowd pleaser'),
      ('fan_favourite', car_likes >= 25, 'Fan favourite'),
      ('streak_7', streak >= 7, '7-day streak'),
      ('streak_30', streak >= 30, '30-day streak'),
      ('meet_regular', meets_n >= 3, 'Meet regular'),
      ('helping_hand', helpful_n >= 5, 'Helping hand'),
      ('seller', listings_n >= 1, 'Seller'),
      ('car_of_the_week', EXISTS (
        SELECT 1 FROM public.car_of_the_week w JOIN public.garage_cars g ON g.id = w.garage_car_id
        WHERE g.user_id = me), 'Car of the Week'),
      ('challenge_winner', EXISTS (
        SELECT 1 FROM public.challenges ch JOIN public.posts p ON p.id = ch.winner_post_id
        WHERE p.user_id = me), 'Challenge winner')
    ) AS t(code, met, label)
  LOOP
    IF candidate.met AND NOT EXISTS (
      SELECT 1 FROM public.user_badges WHERE user_id = me AND badge = candidate.code
    ) THEN
      INSERT INTO public.user_badges (user_id, badge) VALUES (me, candidate.code)
      ON CONFLICT DO NOTHING;
      INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
      VALUES (me, me, 'badge', 'You earned the ' || candidate.label || ' badge!',
        '/u/' || (SELECT username FROM public.profiles WHERE user_id = me));
      earned := earned || candidate.code;
    END IF;
  END LOOP;
  RETURN earned;
END;
$$;
REVOKE ALL ON FUNCTION public.award_my_badges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_my_badges() TO authenticated;

COMMIT;
