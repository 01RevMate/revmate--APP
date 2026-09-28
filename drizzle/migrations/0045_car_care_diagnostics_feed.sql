-- Car care and smarter content. Run after 0044_revmate_news.sql.
--
-- 1. MOT and tax reminders: due dates on garage cars and reminders 30, 7
--    and 1 day before (and the day after if it's missed).
-- 2. Smart diagnostic posts: which part of the car the problem is in,
--    resolved / unresolved with the fix, a nudge to the author to say if
--    it's fixed, and a notification to everyone who liked or commented when
--    it is. common_issues() adds them up per make/model.
-- 3. Simple car tags on posts ("what's this car like?") by make, model,
--    engine and year instead of picking from the catalogue.
-- 4. A taste-aware For You feed: it learns from the viewer's cars (brand
--    tier, fuel type, standard vs modified), persona and likes.
-- 5. trending_hashtags() for hashtag suggestions while writing a post.
-- Everything is additive.

BEGIN;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment', 'like', 'join_request', 'membership', 'friend_request',
    'friend_accepted', 'car_like', 'answer', 'post_review', 'app_update',
    'message', 'car_follow', 'profile_follow',
    'mention', 'comment_reply', 'comment_like', 'meet_rsvp', 'meet_reminder',
    'repost', 'spotted',
    'car_of_week', 'weekly_recap', 'rank_up', 'challenge',
    'price_drop',
    'mot_reminder', 'tax_reminder', 'issue_resolved', 'resolve_prompt'
  )
);

-- ============================================================
-- 1. MOT AND TAX REMINDERS
-- ============================================================
ALTER TABLE public.garage_cars
  ADD COLUMN IF NOT EXISTS mot_due date,
  ADD COLUMN IF NOT EXISTS tax_due date,
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.car_reminders_sent (
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('mot', 'tax')),
  due_date date NOT NULL,
  stage text NOT NULL CHECK (stage IN ('30', '7', '1', 'overdue')),
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (garage_car_id, kind, due_date, stage)
);
ALTER TABLE public.car_reminders_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.car_reminders_sent FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.car_reminders_sent TO service_role;

-- Sends the signed-in person any MOT/tax reminders that are due. The app
-- calls it when they open it; each reminder is only ever sent once.
CREATE OR REPLACE FUNCTION public.send_my_car_reminders()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  today date := (now() AT TIME ZONE 'Europe/London')::date;
  car record;
  item record;
  days integer;
  v_stage text;
  sent integer := 0;
BEGIN
  IF actor IS NULL OR NOT private.is_active_account(actor) THEN RETURN 0; END IF;
  FOR car IN
    SELECT id, nickname, make, model, mot_due, tax_due FROM public.garage_cars
    WHERE user_id = actor AND ownership_status = 'current' AND reminders_enabled
      AND (mot_due IS NOT NULL OR tax_due IS NOT NULL)
  LOOP
    FOR item IN
      SELECT 'mot'::text AS kind, car.mot_due AS due WHERE car.mot_due IS NOT NULL
      UNION ALL
      SELECT 'tax', car.tax_due WHERE car.tax_due IS NOT NULL
    LOOP
      days := item.due - today;
      v_stage := CASE
        WHEN days < 0 AND days >= -14 THEN 'overdue'
        WHEN days BETWEEN 0 AND 1 THEN '1'
        WHEN days BETWEEN 2 AND 7 THEN '7'
        WHEN days BETWEEN 8 AND 30 THEN '30'
      END;
      CONTINUE WHEN v_stage IS NULL;
      -- A later stage covers the earlier ones, so skipping ahead never sends two at once.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.car_reminders_sent s
        WHERE s.garage_car_id = car.id AND s.kind = item.kind AND s.due_date = item.due
          AND (s.stage = v_stage OR (v_stage = '30' AND s.stage IN ('7', '1', 'overdue'))
               OR (v_stage = '7' AND s.stage IN ('1', 'overdue')) OR (v_stage = '1' AND s.stage = 'overdue'))
      );
      INSERT INTO public.car_reminders_sent (garage_car_id, kind, due_date, stage)
      VALUES (car.id, item.kind, item.due, v_stage) ON CONFLICT DO NOTHING;
      INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
      VALUES (
        actor, actor,
        CASE item.kind WHEN 'mot' THEN 'mot_reminder' ELSE 'tax_reminder' END,
        left(
          coalesce(nullif(car.nickname, ''), car.make || ' ' || car.model) || ': '
          || CASE item.kind WHEN 'mot' THEN 'MOT' ELSE 'road tax' END
          || CASE
               WHEN days < 0 THEN ' was due on ' || to_char(item.due, 'FMDD Mon') || ' — sort it today'
               WHEN days = 0 THEN ' is due today'
               WHEN days = 1 THEN ' is due tomorrow'
               ELSE ' is due in ' || days || ' days (' || to_char(item.due, 'FMDD Mon') || ')'
             END,
          500),
        '/garage'
      );
      sent := sent + 1;
    END LOOP;
  END LOOP;
  RETURN sent;
END; $$;
REVOKE ALL ON FUNCTION public.send_my_car_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_my_car_reminders() TO authenticated;

-- ============================================================
-- 2 & 3. DIAGNOSTIC POSTS AND SIMPLE CAR TAGS
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS issue_system text CHECK (issue_system IS NULL OR issue_system IN (
    'engine', 'gearbox', 'electrical', 'bodywork', 'suspension', 'brakes', 'cooling',
    'exhaust', 'fuel', 'steering', 'tyres_wheels', 'interior', 'software', 'other')),
  ADD COLUMN IF NOT EXISTS issue_status text CHECK (issue_status IS NULL OR issue_status IN ('unresolved', 'resolved')),
  ADD COLUMN IF NOT EXISTS issue_fix text CHECK (issue_fix IS NULL OR char_length(issue_fix) <= 2000),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolve_prompts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resolve_prompt_at timestamptz,
  ADD COLUMN IF NOT EXISTS tagged_make text CHECK (tagged_make IS NULL OR char_length(tagged_make) <= 60),
  ADD COLUMN IF NOT EXISTS tagged_model text CHECK (tagged_model IS NULL OR char_length(tagged_model) <= 80),
  ADD COLUMN IF NOT EXISTS tagged_engine text CHECK (tagged_engine IS NULL OR char_length(tagged_engine) <= 60),
  ADD COLUMN IF NOT EXISTS tagged_year int CHECK (tagged_year IS NULL OR tagged_year BETWEEN 1900 AND 2100);

CREATE INDEX IF NOT EXISTS posts_issues_idx ON public.posts (issue_system, issue_status) WHERE issue_status IS NOT NULL;

-- Diagnostic posts start unresolved; other posts carry no issue fields.
CREATE OR REPLACE FUNCTION private.prepare_issue_fields() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.category::text = 'diagnostics' THEN
    NEW.issue_status := coalesce(NEW.issue_status, 'unresolved');
    IF NEW.issue_status = 'resolved' THEN
      NEW.resolved_at := coalesce(NEW.resolved_at, now());
    ELSE
      NEW.resolved_at := NULL;
    END IF;
  ELSE
    NEW.issue_system := NULL;
    NEW.issue_status := NULL;
    NEW.issue_fix := NULL;
    NEW.resolved_at := NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND current_setting('revmate.counter_update', true) IS DISTINCT FROM 'on' THEN
    NEW.resolve_prompts := OLD.resolve_prompts;
    NEW.last_resolve_prompt_at := OLD.last_resolve_prompt_at;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.resolve_prompts := 0;
    NEW.last_resolve_prompt_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS prepare_issue_fields ON public.posts;
CREATE TRIGGER prepare_issue_fields BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.prepare_issue_fields();

-- When an issue is marked fixed, tell everyone who liked or commented.
CREATE OR REPLACE FUNCTION private.notify_issue_resolved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.issue_status = 'resolved' AND OLD.issue_status IS DISTINCT FROM 'resolved' THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
    SELECT DISTINCT people.user_id, NEW.user_id, 'issue_resolved',
      left('A problem you followed has been fixed: ' || left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 80)
        || CASE WHEN nullif(btrim(NEW.issue_fix), '') IS NOT NULL
             THEN ' — Fix: ' || left(NEW.issue_fix, 200) ELSE '' END, 500),
      '/posts/' || NEW.id::text
    FROM (
      SELECT l.user_id FROM public.post_likes l WHERE l.post_id = NEW.id
      UNION
      SELECT c.user_id FROM public.post_comments c WHERE c.post_id = NEW.id
    ) people
    WHERE people.user_id <> NEW.user_id AND private.is_active_account(people.user_id);
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS notify_issue_resolved ON public.posts;
CREATE TRIGGER notify_issue_resolved AFTER UPDATE OF issue_status ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.notify_issue_resolved();
REVOKE ALL ON FUNCTION private.prepare_issue_fields(), private.notify_issue_resolved() FROM PUBLIC, anon, authenticated;

-- Nudges the signed-in person about their unresolved problems: after 3 days,
-- then again after a week, at most three times per post.
CREATE OR REPLACE FUNCTION public.send_my_resolve_prompts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  p record;
  sent integer := 0;
BEGIN
  IF actor IS NULL OR NOT private.is_active_account(actor) THEN RETURN 0; END IF;
  PERFORM set_config('revmate.counter_update', 'on', true);
  FOR p IN
    UPDATE public.posts
    SET resolve_prompts = resolve_prompts + 1, last_resolve_prompt_at = now()
    WHERE user_id = actor AND issue_status = 'unresolved'
      AND created_at < now() - interval '3 days'
      AND resolve_prompts < 3
      AND (last_resolve_prompt_at IS NULL OR last_resolve_prompt_at < now() - interval '7 days')
    RETURNING id, body
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, kind, message, action_url)
    VALUES (actor, actor, 'resolve_prompt',
      left('Did you fix it? "' || left(regexp_replace(p.body, '\s+', ' ', 'g'), 80)
        || '" — tap to mark it resolved or still a problem, and help others with the same issue.', 500),
      '/posts/' || p.id::text);
    sent := sent + 1;
  END LOOP;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN sent;
END; $$;
REVOKE ALL ON FUNCTION public.send_my_resolve_prompts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_my_resolve_prompts() TO authenticated;

-- The make/model a post is about: the car it was posted as, the car tagged,
-- or the catalogue car.
CREATE OR REPLACE FUNCTION private.post_car(target public.posts)
RETURNS TABLE (make text, model text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(target.tagged_make, g.make, c.make), coalesce(target.tagged_model, g.model, c.model)
  FROM (SELECT 1) one
  LEFT JOIN public.garage_cars g ON g.id = target.posted_as_garage_car_id
  LEFT JOIN public.cars c ON c.id = target.car_id
$$;

-- Common problems for a make (and optionally model), grouped by system,
-- with how many have a known fix. Only public, published posts count.
CREATE OR REPLACE FUNCTION public.common_issues(for_make text, for_model text DEFAULT NULL)
RETURNS TABLE (issue_system text, reports bigint, resolved bigint, latest_post_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH issues AS (
    SELECT p.id, p.issue_system, p.issue_status, p.created_at, pc.make, pc.model
    FROM public.posts p
    CROSS JOIN LATERAL private.post_car(p) pc
    WHERE p.issue_status IS NOT NULL AND p.issue_system IS NOT NULL
      AND p.moderation_status = 'published' AND p.group_id IS NULL AND p.audience = 'public'
      AND private.is_active_account(p.user_id)
  )
  SELECT i.issue_system, count(*), count(*) FILTER (WHERE i.issue_status = 'resolved'),
    (array_agg(i.id ORDER BY (i.issue_status = 'resolved') DESC, i.created_at DESC))[1]
  FROM issues i
  WHERE lower(btrim(i.make)) = lower(btrim(for_make))
    AND (for_model IS NULL OR lower(btrim(i.model)) = lower(btrim(for_model)))
  GROUP BY i.issue_system
  ORDER BY count(*) DESC
$$;
REVOKE ALL ON FUNCTION private.post_car(public.posts) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.common_issues(text, text) TO anon, authenticated;

-- ============================================================
-- 4. TASTE-AWARE FOR YOU FEED
-- ============================================================
-- Brand tiers, so someone with a Range Rover sees more premium cars and
-- someone with a modified Civic sees more of that. Admins can edit these.
CREATE TABLE IF NOT EXISTS public.vehicle_make_segments (
  make text PRIMARY KEY,
  segment text NOT NULL CHECK (segment IN ('supercar', 'luxury', 'premium', 'performance', 'mainstream', 'value'))
);
ALTER TABLE public.vehicle_make_segments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vehicle_make_segments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vehicle_make_segments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vehicle_make_segments TO authenticated;
GRANT ALL ON public.vehicle_make_segments TO service_role;
DROP POLICY IF EXISTS make_segments_read ON public.vehicle_make_segments;
CREATE POLICY make_segments_read ON public.vehicle_make_segments FOR SELECT USING (true);
DROP POLICY IF EXISTS make_segments_admin ON public.vehicle_make_segments;
CREATE POLICY make_segments_admin ON public.vehicle_make_segments FOR ALL TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid()))) WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

INSERT INTO public.vehicle_make_segments (make, segment) VALUES
  ('ferrari', 'supercar'), ('lamborghini', 'supercar'), ('mclaren', 'supercar'), ('bugatti', 'supercar'),
  ('pagani', 'supercar'), ('koenigsegg', 'supercar'),
  ('rolls-royce', 'luxury'), ('bentley', 'luxury'), ('aston martin', 'luxury'), ('maserati', 'luxury'),
  ('maybach', 'luxury'),
  ('porsche', 'premium'), ('mercedes-benz', 'premium'), ('mercedes', 'premium'), ('bmw', 'premium'),
  ('audi', 'premium'), ('land rover', 'premium'), ('range rover', 'premium'), ('jaguar', 'premium'),
  ('lexus', 'premium'), ('volvo', 'premium'), ('tesla', 'premium'), ('genesis', 'premium'),
  ('polestar', 'premium'), ('alfa romeo', 'premium'), ('ds', 'premium'), ('infiniti', 'premium'),
  ('lotus', 'performance'), ('alpine', 'performance'), ('cupra', 'performance'), ('subaru', 'performance'),
  ('abarth', 'performance'), ('tvr', 'performance'), ('caterham', 'performance'), ('morgan', 'performance'),
  ('volkswagen', 'mainstream'), ('ford', 'mainstream'), ('vauxhall', 'mainstream'), ('toyota', 'mainstream'),
  ('honda', 'mainstream'), ('nissan', 'mainstream'), ('mazda', 'mainstream'), ('hyundai', 'mainstream'),
  ('kia', 'mainstream'), ('peugeot', 'mainstream'), ('renault', 'mainstream'), ('citroen', 'mainstream'),
  ('citroën', 'mainstream'), ('skoda', 'mainstream'), ('škoda', 'mainstream'), ('seat', 'mainstream'),
  ('mini', 'mainstream'), ('fiat', 'mainstream'), ('mitsubishi', 'mainstream'), ('suzuki', 'mainstream'),
  ('jeep', 'mainstream'), ('smart', 'mainstream'), ('byd', 'mainstream'), ('mg', 'value'),
  ('dacia', 'value'), ('ssangyong', 'value'), ('kgm', 'value'), ('proton', 'value'), ('lada', 'value'),
  ('chevrolet', 'mainstream'), ('dodge', 'performance'), ('cadillac', 'premium'), ('lincoln', 'premium')
ON CONFLICT (make) DO NOTHING;

CREATE OR REPLACE FUNCTION private.segment_rank(segment text) RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE segment WHEN 'supercar' THEN 5 WHEN 'luxury' THEN 4 WHEN 'premium' THEN 3
    WHEN 'performance' THEN 3 WHEN 'mainstream' THEN 2 WHEN 'value' THEN 1 END
$$;

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
  )
  SELECT p.*
  FROM public.posts p
  CROSS JOIN viewer
  CROSS JOIN taste
  LEFT JOIN public.garage_cars g ON g.id = p.posted_as_garage_car_id
  LEFT JOIN public.cars c ON c.id = p.car_id
  LEFT JOIN public.vehicle_make_segments seg
    ON seg.make = lower(btrim(coalesce(p.tagged_make, g.make, c.make, '')))
  LEFT JOIN liked_authors la ON la.user_id = p.user_id
  LEFT JOIN liked_categories lc ON lc.category = p.category::text
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
    ) DESC,
    p.created_at DESC,
    p.id DESC
  LIMIT 30 OFFSET greatest(0, least(page_offset, 10000));
$$;
GRANT EXECUTE ON FUNCTION public.for_you_feed(integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.segment_rank(text) TO anon, authenticated;

-- ============================================================
-- 5. HASHTAG SUGGESTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.trending_hashtags(prefix text DEFAULT '', result_limit integer DEFAULT 8)
RETURNS TABLE (tag text, uses bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT lower(m[1]) AS tag, count(*) AS uses
  FROM public.posts p
  CROSS JOIN LATERAL regexp_matches(p.body, '(?:^|[^A-Za-z0-9_&])#([A-Za-z][A-Za-z0-9_]{1,39})', 'g') AS m
  WHERE p.created_at > now() - interval '60 days'
    AND p.moderation_status = 'published' AND p.group_id IS NULL AND p.audience = 'public'
    AND lower(m[1]) LIKE lower(regexp_replace(coalesce(prefix, ''), '[^A-Za-z0-9_]', '', 'g')) || '%'
  GROUP BY lower(m[1])
  ORDER BY count(*) DESC, lower(m[1])
  LIMIT least(greatest(result_limit, 1), 20)
$$;
GRANT EXECUTE ON FUNCTION public.trending_hashtags(text, integer) TO anon, authenticated;

COMMIT;
