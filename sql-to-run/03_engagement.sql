-- STEP 3 — Engagement pack (For You feed, onboarding, Car Battles &
-- Car of the Week, weekly recaps, rank-up alerts, streaks & levels, Revs,
-- Stories, weekly challenges, Near you, reactions, notification settings)
-- Copy of drizzle/migrations/0033_engagement.sql
-- Run the WHOLE file, once, after step 2.

-- Engagement pack: For You feed, onboarding, Car Battles & Car of the Week,
-- weekly recaps, rank-up alerts, streaks & levels, Revs video feed,
-- Stories (Pit Stops), weekly challenges, Near you, reactions and
-- notification settings. Run after 0031_social_features.sql.
--
-- Everything is additive — no existing rows are deleted.

BEGIN;

-- ============================================================
-- NOTIFICATION KINDS
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment', 'like', 'join_request', 'membership', 'friend_request',
    'friend_accepted', 'car_like', 'answer', 'post_review', 'app_update',
    'message', 'car_follow', 'profile_follow',
    'mention', 'comment_reply', 'comment_like', 'meet_rsvp', 'meet_reminder',
    'repost', 'spotted',
    'car_of_week', 'weekly_recap', 'rank_up', 'challenge'
  )
);

-- Today's date in the UK, used for streaks, battles and weekly recaps.
CREATE FUNCTION private.uk_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = ''
AS $$ SELECT (now() AT TIME ZONE 'Europe/London')::date $$;
GRANT EXECUTE ON FUNCTION private.uk_today() TO anon, authenticated;

-- ============================================================
-- NOTIFICATION SETTINGS (private to each user)
-- ============================================================
CREATE TABLE public.notification_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  quiet_hours boolean NOT NULL DEFAULT false,
  muted_kinds text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_settings TO authenticated;
GRANT ALL ON public.notification_settings TO service_role;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own notification settings"
ON public.notification_settings FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users create their own notification settings"
ON public.notification_settings FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users change their own notification settings"
ON public.notification_settings FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- Muted kinds are never created at all (in the app or on the phone).
CREATE FUNCTION private.skip_muted_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notification_settings s
    WHERE s.user_id = NEW.user_id AND NEW.kind = ANY(s.muted_kinds)
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.skip_muted_notification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER skip_muted_notification
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION private.skip_muted_notification();

-- ============================================================
-- ONBOARDING, STREAKS
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS favourite_makes text[] NOT NULL DEFAULT '{}'
    CHECK (cardinality(favourite_makes) <= 20),
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_on date;

-- Streaks are only moved by record_daily_activity(), never by profile edits.
CREATE FUNCTION private.protect_profile_streaks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) = 'on' THEN RETURN NEW; END IF;
  NEW.current_streak := OLD.current_streak;
  NEW.longest_streak := OLD.longest_streak;
  NEW.last_active_on := OLD.last_active_on;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_profile_streaks() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_profile_streaks
BEFORE UPDATE OF current_streak, longest_streak, last_active_on ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.protect_profile_streaks();

-- Called when the app opens: counts consecutive UK days the user visited.
CREATE FUNCTION public.record_daily_activity()
RETURNS TABLE (current_streak int, longest_streak int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  today date := private.uk_today();
  prof public.profiles%ROWTYPE;
  next_streak int;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT * INTO prof FROM public.profiles WHERE user_id = me;
  IF NOT FOUND THEN RETURN; END IF;
  IF prof.last_active_on = today THEN
    RETURN QUERY SELECT prof.current_streak, prof.longest_streak;
    RETURN;
  END IF;
  next_streak := CASE WHEN prof.last_active_on = today - 1 THEN prof.current_streak + 1 ELSE 1 END;
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.profiles p
  SET current_streak = next_streak,
      longest_streak = GREATEST(p.longest_streak, next_streak),
      last_active_on = today
  WHERE p.user_id = me;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN QUERY SELECT next_streak, GREATEST(prof.longest_streak, next_streak);
END;
$$;
REVOKE ALL ON FUNCTION public.record_daily_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_daily_activity() TO authenticated;

-- ============================================================
-- CAR BATTLES & CAR OF THE WEEK
-- ============================================================
ALTER TABLE public.garage_cars
  ADD COLUMN IF NOT EXISTS battle_wins int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS battle_losses int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rank int;

CREATE FUNCTION private.protect_garage_car_battle_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) = 'on' THEN RETURN NEW; END IF;
  NEW.battle_wins := OLD.battle_wins;
  NEW.battle_losses := OLD.battle_losses;
  NEW.last_rank := OLD.last_rank;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_garage_car_battle_stats() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_garage_car_battle_stats
BEFORE UPDATE OF battle_wins, battle_losses, last_rank ON public.garage_cars
FOR EACH ROW EXECUTE FUNCTION private.protect_garage_car_battle_stats();

CREATE TABLE public.car_battle_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  winner_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  loser_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  voted_on date NOT NULL DEFAULT private.uk_today(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (winner_car_id <> loser_car_id)
);
-- One vote per pair per person per day, whichever way round.
CREATE UNIQUE INDEX car_battle_votes_once_per_day_idx ON public.car_battle_votes (
  voter_id, LEAST(winner_car_id, loser_car_id), GREATEST(winner_car_id, loser_car_id), voted_on
);
CREATE INDEX car_battle_votes_week_idx ON public.car_battle_votes(voted_on, winner_car_id);
GRANT SELECT ON public.car_battle_votes TO authenticated;
GRANT ALL ON public.car_battle_votes TO service_role;
ALTER TABLE public.car_battle_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own battle votes"
ON public.car_battle_votes FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = voter_id);

-- Two random current cars with photos, not yours, not ones you've skipped.
CREATE FUNCTION public.next_car_battle(exclude_ids uuid[] DEFAULT '{}')
RETURNS TABLE (
  id uuid, user_id uuid, username text, nickname text, make text, model text,
  year int, photo_url text, battle_wins int, battle_losses int
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT g.id, g.user_id, p.username, g.nickname, g.make, g.model, g.year,
    g.photo_url, g.battle_wins, g.battle_losses
  FROM public.garage_cars g
  JOIN public.profiles p ON p.user_id = g.user_id
  WHERE g.ownership_status = 'current'
    AND g.photo_url IS NOT NULL AND g.photo_url <> ''
    AND p.account_status = 'active'
    AND g.user_id IS DISTINCT FROM (SELECT auth.uid())
    AND NOT (g.id = ANY(coalesce(exclude_ids, '{}')))
    AND NOT private.users_are_blocked(g.user_id, (SELECT auth.uid()))
  ORDER BY random()
  LIMIT 2;
$$;
REVOKE ALL ON FUNCTION public.next_car_battle(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_car_battle(uuid[]) TO anon, authenticated;

CREATE FUNCTION public.vote_car_battle(winner uuid, loser uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN
    RAISE EXCEPTION 'Sign in to vote';
  END IF;
  IF winner = loser OR (
    SELECT count(*) FROM public.garage_cars
    WHERE id IN (winner, loser) AND ownership_status = 'current' AND user_id <> me
  ) <> 2 THEN
    RAISE EXCEPTION 'That battle is no longer available';
  END IF;
  IF (
    SELECT count(*) FROM public.car_battle_votes
    WHERE voter_id = me AND voted_on = private.uk_today()
  ) >= 500 THEN
    RAISE EXCEPTION 'That''s a lot of battles for one day — come back tomorrow';
  END IF;
  BEGIN
    INSERT INTO public.car_battle_votes(voter_id, winner_car_id, loser_car_id)
    VALUES (me, winner, loser);
  EXCEPTION WHEN unique_violation THEN
    RETURN; -- already voted on this pair today; quietly move on
  END;
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.garage_cars SET battle_wins = battle_wins + 1 WHERE id = winner;
  UPDATE public.garage_cars SET battle_losses = battle_losses + 1 WHERE id = loser;
  PERFORM set_config('revmate.counter_update', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.vote_car_battle(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_car_battle(uuid, uuid) TO authenticated;

CREATE TABLE public.car_of_the_week (
  week_start date PRIMARY KEY,
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  wins int NOT NULL,
  crowned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.car_of_the_week TO anon, authenticated;
GRANT ALL ON public.car_of_the_week TO service_role;
ALTER TABLE public.car_of_the_week ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Car of the week is public"
ON public.car_of_the_week FOR SELECT TO anon, authenticated USING (true);

-- Crowns last week's (Mon–Sun) battle winner. Safe to call any time — the
-- app calls it on open; each week is only ever crowned once.
CREATE FUNCTION public.crown_car_of_the_week()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  last_week date := date_trunc('week', private.uk_today())::date - 7;
  champion record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.car_of_the_week WHERE week_start = last_week) THEN
    RETURN NULL;
  END IF;
  SELECT v.winner_car_id AS car_id, count(*)::int AS wins
  INTO champion
  FROM public.car_battle_votes v
  JOIN public.garage_cars g ON g.id = v.winner_car_id AND g.ownership_status = 'current'
  WHERE v.voted_on >= last_week AND v.voted_on < last_week + 7
  GROUP BY v.winner_car_id
  HAVING count(*) >= 3
  ORDER BY count(*) DESC, min(v.created_at)
  LIMIT 1;
  IF champion.car_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.car_of_the_week(week_start, garage_car_id, wins)
  VALUES (last_week, champion.car_id, champion.wins)
  ON CONFLICT (week_start) DO NOTHING;
  IF NOT FOUND THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, garage_car_id, message, action_url)
  SELECT g.user_id, g.user_id, 'car_of_week', g.id,
    left(g.nickname || ' is RevMate Car of the Week with ' || champion.wins || ' battle wins!', 500),
    '/u/' || p.username || '/cars/' || g.id::text
  FROM public.garage_cars g JOIN public.profiles p ON p.user_id = g.user_id
  WHERE g.id = champion.car_id;
  RETURN champion.car_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crown_car_of_the_week() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crown_car_of_the_week() TO authenticated;

-- ============================================================
-- WEEKLY RECAP & RANK-UP ALERTS (each user triggers their own on app open)
-- ============================================================
CREATE TABLE public.weekly_recaps (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  week_start date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);
GRANT SELECT ON public.weekly_recaps TO authenticated;
GRANT ALL ON public.weekly_recaps TO service_role;
ALTER TABLE public.weekly_recaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own recaps"
ON public.weekly_recaps FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE FUNCTION public.send_my_weekly_recap()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  last_week date := date_trunc('week', private.uk_today())::date - 7;
  since timestamptz;
  until timestamptz;
  like_total int;
  follower_total int;
  best record;
  summary text;
BEGIN
  IF me IS NULL THEN RETURN false; END IF;
  INSERT INTO public.weekly_recaps(user_id, week_start) VALUES (me, last_week)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  since := last_week::timestamp AT TIME ZONE 'Europe/London';
  until := (last_week + 7)::timestamp AT TIME ZONE 'Europe/London';
  SELECT
    (SELECT count(*) FROM public.post_likes l JOIN public.posts p ON p.id = l.post_id
      WHERE p.user_id = me AND l.user_id <> me AND l.created_at >= since AND l.created_at < until)
    + (SELECT count(*) FROM public.garage_car_likes l JOIN public.garage_cars g ON g.id = l.garage_car_id
      WHERE g.user_id = me AND l.user_id <> me AND l.created_at >= since AND l.created_at < until)
  INTO like_total;
  SELECT count(*) INTO follower_total FROM public.profile_follows
  WHERE followed_id = me AND created_at >= since AND created_at < until;
  SELECT g.nickname, public.rank_garage_car(g.id) AS car_rank INTO best
  FROM public.garage_cars g
  WHERE g.user_id = me AND g.ownership_status = 'current'
  ORDER BY public.rank_garage_car(g.id) NULLS LAST
  LIMIT 1;

  IF like_total = 0 AND follower_total = 0 AND best.car_rank IS NULL THEN
    RETURN false; -- nothing worth telling them
  END IF;
  summary := 'Your week: ' || like_total || CASE WHEN like_total = 1 THEN ' like' ELSE ' likes' END
    || ', ' || follower_total || CASE WHEN follower_total = 1 THEN ' new follower' ELSE ' new followers' END;
  IF best.car_rank IS NOT NULL THEN
    summary := summary || ', and ' || best.nickname || ' is ranked #' || best.car_rank;
  END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  VALUES (me, me, 'weekly_recap', left(summary, 500), '/analytics');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.send_my_weekly_recap() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_my_weekly_recap() TO authenticated;

CREATE FUNCTION public.check_my_rank_changes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  car record;
  new_rank int;
  alerts int := 0;
BEGIN
  IF me IS NULL THEN RETURN 0; END IF;
  PERFORM set_config('revmate.counter_update', 'on', true);
  FOR car IN
    SELECT g.id, g.nickname, g.last_rank, p.username
    FROM public.garage_cars g JOIN public.profiles p ON p.user_id = g.user_id
    WHERE g.user_id = me AND g.ownership_status = 'current'
  LOOP
    new_rank := public.rank_garage_car(car.id);
    IF new_rank IS NULL THEN CONTINUE; END IF;
    -- Worth a ping: into the top 25, or up 5+ places.
    IF car.last_rank IS NOT NULL AND new_rank < car.last_rank
      AND (new_rank <= 25 OR car.last_rank - new_rank >= 5) THEN
      INSERT INTO public.notifications(user_id, actor_id, kind, garage_car_id, message, action_url)
      VALUES (me, me, 'rank_up', car.id,
        left('Your ' || car.nickname || ' moved up to #' || new_rank || ' in the UK', 500),
        '/leaderboard');
      alerts := alerts + 1;
    END IF;
    UPDATE public.garage_cars SET last_rank = new_rank WHERE id = car.id;
  END LOOP;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN alerts;
END;
$$;
REVOKE ALL ON FUNCTION public.check_my_rank_changes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_my_rank_changes() TO authenticated;

-- ============================================================
-- LEVELS (worked out from activity, nothing to fake)
-- ============================================================
CREATE FUNCTION public.profile_level(target_user uuid)
RETURNS TABLE (xp int, level_name text, level_floor int, next_level_at int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE total int;
BEGIN
  SELECT
    10 * (SELECT count(*) FROM public.posts WHERE user_id = target_user AND repost_of_id IS NULL)
    + 3 * (SELECT count(*) FROM public.post_comments WHERE user_id = target_user)
    + (SELECT coalesce(sum(likes_count), 0) FROM public.posts WHERE user_id = target_user)
    + (SELECT coalesce(sum(likes_count), 0) FROM public.garage_cars WHERE user_id = target_user)
    + (SELECT count(*) FROM public.car_battle_votes WHERE voter_id = target_user)
    + 5 * (SELECT count(*) FROM public.meet_attendees WHERE user_id = target_user AND status = 'going')
    + 2 * (SELECT coalesce(longest_streak, 0) FROM public.profiles WHERE user_id = target_user)
  INTO total;
  RETURN QUERY SELECT total,
    CASE WHEN total >= 2000 THEN 'Legend' WHEN total >= 500 THEN 'Petrolhead'
         WHEN total >= 100 THEN 'Enthusiast' ELSE 'Learner' END,
    CASE WHEN total >= 2000 THEN 2000 WHEN total >= 500 THEN 500
         WHEN total >= 100 THEN 100 ELSE 0 END,
    CASE WHEN total >= 2000 THEN NULL WHEN total >= 500 THEN 2000
         WHEN total >= 100 THEN 500 ELSE 100 END;
END;
$$;
REVOKE ALL ON FUNCTION public.profile_level(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_level(uuid) TO anon, authenticated;

-- ============================================================
-- REACTIONS (🔥 😍 🤯 😂 as well as like)
-- ============================================================
ALTER TABLE public.post_likes
  ADD COLUMN IF NOT EXISTS reaction text NOT NULL DEFAULT 'like'
  CHECK (reaction IN ('like', 'fire', 'love', 'wow', 'haha'));
GRANT UPDATE (reaction) ON public.post_likes TO authenticated;
CREATE POLICY "Users change their own reaction"
ON public.post_likes FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE FUNCTION private.handle_post_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.posts
    SET reaction_counts = jsonb_set(
      reaction_counts, ARRAY[OLD.reaction],
      to_jsonb(GREATEST(coalesce((reaction_counts ->> OLD.reaction)::int, 0) - 1, 0))
    )
    WHERE id = OLD.post_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.posts
    SET reaction_counts = jsonb_set(
      reaction_counts, ARRAY[NEW.reaction],
      to_jsonb(coalesce((reaction_counts ->> NEW.reaction)::int, 0) + 1)
    )
    WHERE id = NEW.post_id;
  END IF;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.handle_post_reaction_counts() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_post_reaction_change
AFTER INSERT OR DELETE OR UPDATE OF reaction ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION private.handle_post_reaction_counts();

-- Existing likes all count as 'like'.
SELECT set_config('revmate.counter_update', 'on', true);
UPDATE public.posts
SET reaction_counts = jsonb_build_object('like', likes_count)
WHERE likes_count > 0;
SELECT set_config('revmate.counter_update', 'off', true);

-- Reaction counts join the counters only the database may change.
CREATE OR REPLACE FUNCTION private.protect_social_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'post_comments' THEN
    NEW.likes_count := OLD.likes_count;
    NEW.parent_id := OLD.parent_id;
  ELSIF TG_TABLE_NAME = 'posts' THEN
    NEW.reposts_count := OLD.reposts_count;
    NEW.repost_of_id := OLD.repost_of_id;
    NEW.reaction_counts := OLD.reaction_counts;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- NEAR YOU (locations rounded to ~1km for privacy)
-- ============================================================
ALTER TABLE public.car_meets
  ADD COLUMN IF NOT EXISTS latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS longitude double precision CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS longitude double precision CHECK (longitude BETWEEN -180 AND 180);
CREATE INDEX IF NOT EXISTS car_meets_location_idx ON public.car_meets(latitude, longitude)
  WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_location_idx ON public.posts(latitude, longitude)
  WHERE latitude IS NOT NULL;

-- Posts only ever store a location to 2 decimal places (~1km), so a
-- spotted photo can't pinpoint someone's driveway.
CREATE FUNCTION private.round_post_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.latitude := round(NEW.latitude::numeric, 2)::double precision;
  NEW.longitude := round(NEW.longitude::numeric, 2)::double precision;
  RETURN NEW;
END;
$$;
CREATE TRIGGER round_post_location
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.round_post_location();

CREATE FUNCTION private.distance_km(lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;
GRANT EXECUTE ON FUNCTION private.distance_km(double precision, double precision, double precision, double precision)
  TO anon, authenticated;

CREATE FUNCTION public.nearby_meets(lat double precision, lng double precision, radius_km double precision DEFAULT 50)
RETURNS SETOF public.car_meets
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT m.*
  FROM public.car_meets m
  WHERE m.latitude IS NOT NULL
    AND m.cancelled_at IS NULL
    AND m.starts_at > now() - interval '6 hours'
    AND m.latitude BETWEEN lat - radius_km / 111.0 AND lat + radius_km / 111.0
    AND private.distance_km(lat, lng, m.latitude, m.longitude) <= LEAST(radius_km, 300)
  ORDER BY m.starts_at
  LIMIT 50;
$$;
GRANT EXECUTE ON FUNCTION public.nearby_meets(double precision, double precision, double precision) TO anon, authenticated;

CREATE FUNCTION public.nearby_posts(lat double precision, lng double precision,
  radius_km double precision DEFAULT 50, page_offset integer DEFAULT 0)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.latitude IS NOT NULL
    AND p.moderation_status = 'published' AND p.group_id IS NULL AND p.audience = 'public'
    AND p.latitude BETWEEN lat - radius_km / 111.0 AND lat + radius_km / 111.0
    AND private.distance_km(lat, lng, p.latitude, p.longitude) <= LEAST(radius_km, 300)
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT 30 OFFSET greatest(0, least(page_offset, 10000));
$$;
GRANT EXECUTE ON FUNCTION public.nearby_posts(double precision, double precision, double precision, integer) TO anon, authenticated;

-- ============================================================
-- FOR YOU FEED & PEOPLE TO FOLLOW
-- ============================================================
-- Ranked for the viewer: engagement, people they follow, makes they own or
-- picked at sign-up, authors they've liked, with newer posts favoured.
CREATE FUNCTION public.for_you_feed(page_offset integer DEFAULT 0, filter_category text DEFAULT 'all')
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH viewer AS (SELECT (SELECT auth.uid()) AS id),
  my_makes AS (
    SELECT lower(btrim(g.make)) AS make FROM public.garage_cars g, viewer
    WHERE g.user_id = viewer.id AND g.ownership_status = 'current'
    UNION
    SELECT lower(btrim(m)) FROM public.profiles pr, viewer, unnest(pr.favourite_makes) AS m
    WHERE pr.user_id = viewer.id
  ),
  liked_authors AS (
    SELECT p.user_id, count(*) AS n
    FROM public.post_likes l JOIN public.posts p ON p.id = l.post_id, viewer
    WHERE l.user_id = viewer.id AND l.created_at > now() - interval '60 days'
    GROUP BY p.user_id
  )
  SELECT p.*
  FROM public.posts p
  CROSS JOIN viewer
  LEFT JOIN public.garage_cars g ON g.id = p.posted_as_garage_car_id
  LEFT JOIN public.cars c ON c.id = p.car_id
  LEFT JOIN liked_authors la ON la.user_id = p.user_id
  WHERE p.moderation_status = 'published'
    AND p.group_id IS NULL
    AND p.created_at > now() - interval '45 days'
    AND (filter_category = 'all' OR p.category::text = filter_category)
    AND (
      p.audience = 'public'
      OR (viewer.id IS NOT NULL AND (p.user_id = viewer.id OR private.is_following(viewer.id, p.user_id)))
    )
  ORDER BY (
      ln(1 + p.likes_count + 2 * p.comments_count + 3 * p.reposts_count
        + coalesce(g.likes_count, 0) * 0.5)
      + CASE WHEN viewer.id IS NOT NULL AND private.is_following(viewer.id, p.user_id) THEN 2.5 ELSE 0 END
      + CASE WHEN lower(btrim(coalesce(g.make, c.make, ''))) IN (SELECT make FROM my_makes) THEN 2 ELSE 0 END
      + ln(1 + coalesce(la.n, 0))
      - CASE WHEN p.user_id = viewer.id THEN 1 ELSE 0 END
      - extract(epoch FROM now() - p.created_at) / 43200.0
    ) DESC,
    p.created_at DESC,
    p.id DESC
  LIMIT 30 OFFSET greatest(0, least(page_offset, 10000));
$$;
GRANT EXECUTE ON FUNCTION public.for_you_feed(integer, text) TO anon, authenticated;

CREATE FUNCTION public.suggested_profiles(result_limit integer DEFAULT 12)
RETURNS TABLE (user_id uuid, username text, avatar_url text, reason text, followers bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH viewer AS (SELECT (SELECT auth.uid()) AS id),
  my_makes AS (
    SELECT lower(btrim(g.make)) AS make FROM public.garage_cars g, viewer
    WHERE g.user_id = viewer.id AND g.ownership_status = 'current'
    UNION
    SELECT lower(btrim(m)) FROM public.profiles pr, viewer, unnest(pr.favourite_makes) AS m
    WHERE pr.user_id = viewer.id
  ),
  candidates AS (
    SELECT p.user_id, p.username, p.avatar_url,
      (SELECT g.make FROM public.garage_cars g
        WHERE g.user_id = p.user_id AND g.ownership_status = 'current'
          AND lower(btrim(g.make)) IN (SELECT make FROM my_makes)
        LIMIT 1) AS shared_make,
      (SELECT count(*) FROM public.profile_follows f WHERE f.followed_id = p.user_id) AS followers,
      EXISTS (SELECT 1 FROM public.posts po WHERE po.user_id = p.user_id
        AND po.created_at > now() - interval '30 days') AS recently_active
    FROM public.profiles p, viewer
    WHERE p.account_status = 'active'
      AND p.user_id IS DISTINCT FROM viewer.id
      AND NOT private.users_are_blocked(p.user_id, viewer.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.profile_follows f
        WHERE f.follower_id = viewer.id AND f.followed_id = p.user_id
      )
  )
  SELECT user_id, username, avatar_url,
    CASE WHEN shared_make IS NOT NULL THEN 'Also drives a ' || shared_make
         WHEN recently_active THEN 'Active this month'
         ELSE 'Popular on RevMate' END,
    followers
  FROM candidates
  ORDER BY (shared_make IS NOT NULL) DESC, recently_active DESC, followers DESC, username
  LIMIT greatest(1, least(result_limit, 50));
$$;
REVOKE ALL ON FUNCTION public.suggested_profiles(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suggested_profiles(integer) TO authenticated;

-- ============================================================
-- REVS — full-screen video feed
-- ============================================================
CREATE FUNCTION public.revs_feed(page_offset integer DEFAULT 0)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.moderation_status = 'published'
    AND p.group_id IS NULL
    AND p.audience = 'public'
    AND EXISTS (
      SELECT 1 FROM public.post_images i
      WHERE i.post_id = p.id AND i.image_url ~* '\.(mp4|mov|webm|m4v)(\?|$)'
    )
  ORDER BY (
      ln(1 + p.likes_count + 2 * p.comments_count + 3 * p.reposts_count)
      - extract(epoch FROM now() - p.created_at) / 86400.0
    ) DESC,
    p.created_at DESC
  LIMIT 10 OFFSET greatest(0, least(page_offset, 10000));
$$;
GRANT EXECUTE ON FUNCTION public.revs_feed(integer) TO anon, authenticated;

-- ============================================================
-- STORIES ("Pit Stops") — photos/clips that disappear after 24 hours
-- ============================================================
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  media_url text NOT NULL CHECK (media_url LIKE 'https://%'),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  caption text CHECK (caption IS NULL OR char_length(caption) <= 200),
  views_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX stories_active_idx ON public.stories(expires_at DESC, user_id);
GRANT SELECT ON public.stories TO anon;
GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live stories are viewable"
ON public.stories FOR SELECT TO anon, authenticated
USING (
  expires_at > now()
  AND private.is_active_account(user_id)
  AND NOT private.users_are_blocked(user_id, (SELECT auth.uid()))
);
CREATE POLICY "Active users post their own stories"
ON public.stories FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.is_active_account((SELECT auth.uid()))
  AND views_count = 0
  AND expires_at <= now() + interval '24 hours 5 minutes'
);
CREATE POLICY "Users and admins delete stories"
ON public.stories FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) = user_id OR private.is_revmate_admin((SELECT auth.uid()))
);

CREATE TABLE public.story_views (
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, viewer_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Viewers and story owners see views"
ON public.story_views FOR SELECT TO authenticated
USING (
  viewer_id = (SELECT auth.uid())
  OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = (SELECT auth.uid()))
);
CREATE POLICY "Users record their own story views"
ON public.story_views FOR INSERT TO authenticated
WITH CHECK (viewer_id = (SELECT auth.uid()));

CREATE FUNCTION private.count_story_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.stories SET views_count = views_count + 1
  WHERE id = NEW.story_id AND user_id <> NEW.viewer_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.count_story_view() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER count_story_view
AFTER INSERT ON public.story_views
FOR EACH ROW EXECUTE FUNCTION private.count_story_view();

-- ============================================================
-- WEEKLY CHALLENGES (#StanceSunday, photo comps…), run by admins
-- ============================================================
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL CHECK (tag ~ '^[a-z][a-z0-9_]{1,39}$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  starts_on date NOT NULL,
  ends_on date NOT NULL CHECK (ends_on >= starts_on),
  winner_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX challenges_dates_idx ON public.challenges(ends_on DESC, starts_on);
GRANT SELECT ON public.challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges are public"
ON public.challenges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins create challenges"
ON public.challenges FOR INSERT TO authenticated
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins edit challenges"
ON public.challenges FOR UPDATE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())))
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins delete challenges"
ON public.challenges FOR DELETE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())));

CREATE FUNCTION private.notify_challenge_winner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE winner uuid;
BEGIN
  IF NEW.winner_post_id IS NULL OR NEW.winner_post_id IS NOT DISTINCT FROM OLD.winner_post_id THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO winner FROM public.posts WHERE id = NEW.winner_post_id;
  IF winner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, post_id, message, action_url)
    VALUES (winner, coalesce((SELECT auth.uid()), winner), 'challenge', NEW.winner_post_id,
      left('Your post won the #' || NEW.tag || ' challenge!', 500),
      '/posts/' || NEW.winner_post_id::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_challenge_winner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_challenge_winner
AFTER UPDATE OF winner_post_id ON public.challenges
FOR EACH ROW EXECUTE FUNCTION private.notify_challenge_winner();

COMMIT;
