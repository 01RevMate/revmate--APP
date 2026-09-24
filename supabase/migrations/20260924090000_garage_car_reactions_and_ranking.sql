-- Run after 20260923013000_message_images_and_receipts.sql.
-- Adds car dislikes, car follows, three-tier net-score ranking RPCs, and
-- links marketplace listings to a specific owned garage car.
BEGIN;

-- ============================================================
-- DISLIKES (mirrors garage_car_likes exactly)
-- ============================================================
ALTER TABLE public.garage_cars ADD COLUMN dislikes_count int NOT NULL DEFAULT 0;

CREATE TABLE public.garage_car_dislikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (garage_car_id, user_id)
);
CREATE INDEX garage_car_dislikes_garage_car_id_idx ON public.garage_car_dislikes(garage_car_id);
GRANT SELECT ON public.garage_car_dislikes TO anon;
GRANT SELECT, INSERT, DELETE ON public.garage_car_dislikes TO authenticated;
GRANT ALL ON public.garage_car_dislikes TO service_role;
ALTER TABLE public.garage_car_dislikes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Car dislikes are viewable by everyone" ON public.garage_car_dislikes;
CREATE POLICY "Car dislikes are viewable by everyone" ON public.garage_car_dislikes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users dislike as themselves" ON public.garage_car_dislikes;
CREATE POLICY "Users dislike as themselves" ON public.garage_car_dislikes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users remove own car dislike" ON public.garage_car_dislikes;
CREATE POLICY "Users remove own car dislike" ON public.garage_car_dislikes FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.handle_garage_car_dislike_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.garage_cars SET dislikes_count = dislikes_count + 1 WHERE id = NEW.garage_car_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.garage_cars SET dislikes_count = GREATEST(dislikes_count - 1, 0) WHERE id = OLD.garage_car_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER on_garage_car_dislike_change
AFTER INSERT OR DELETE ON public.garage_car_dislikes
FOR EACH ROW EXECUTE FUNCTION public.handle_garage_car_dislike_change();

-- A like and a dislike on the same car by the same user are mutually
-- exclusive (liking clears any existing dislike and vice versa).
CREATE OR REPLACE FUNCTION private.enforce_single_garage_car_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'garage_car_likes' THEN
    DELETE FROM public.garage_car_dislikes
    WHERE garage_car_id = NEW.garage_car_id AND user_id = NEW.user_id;
  ELSE
    DELETE FROM public.garage_car_likes
    WHERE garage_car_id = NEW.garage_car_id AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_single_reaction_on_like
BEFORE INSERT ON public.garage_car_likes
FOR EACH ROW EXECUTE FUNCTION private.enforce_single_garage_car_reaction();
CREATE TRIGGER enforce_single_reaction_on_dislike
BEFORE INSERT ON public.garage_car_dislikes
FOR EACH ROW EXECUTE FUNCTION private.enforce_single_garage_car_reaction();

-- ============================================================
-- FOLLOWS (mirrors garage_car_likes exactly, + notification wiring)
-- ============================================================
ALTER TABLE public.garage_cars ADD COLUMN followers_count int NOT NULL DEFAULT 0;

CREATE TABLE public.garage_car_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_car_id uuid NOT NULL REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (garage_car_id, user_id)
);
CREATE INDEX garage_car_follows_garage_car_id_idx ON public.garage_car_follows(garage_car_id);
CREATE INDEX garage_car_follows_user_id_idx ON public.garage_car_follows(user_id);
GRANT SELECT ON public.garage_car_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.garage_car_follows TO authenticated;
GRANT ALL ON public.garage_car_follows TO service_role;
ALTER TABLE public.garage_car_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Car follows are viewable by everyone" ON public.garage_car_follows;
CREATE POLICY "Car follows are viewable by everyone" ON public.garage_car_follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users follow as themselves" ON public.garage_car_follows;
CREATE POLICY "Users follow as themselves" ON public.garage_car_follows FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users remove own car follow" ON public.garage_car_follows;
CREATE POLICY "Users remove own car follow" ON public.garage_car_follows FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.handle_garage_car_follow_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.garage_cars SET followers_count = followers_count + 1 WHERE id = NEW.garage_car_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.garage_cars SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.garage_car_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER on_garage_car_follow_change
AFTER INSERT OR DELETE ON public.garage_car_follows
FOR EACH ROW EXECUTE FUNCTION public.handle_garage_car_follow_change();

-- Add 'car_follow' to the notification kind check constraint.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment',
    'like',
    'join_request',
    'membership',
    'friend_request',
    'friend_accepted',
    'car_like',
    'answer',
    'post_review',
    'app_update',
    'message',
    'car_follow'
  )
);

-- Extend the shared dispatcher with a garage_car_follows branch (same
-- function as 20260922223000_complete_in_app_notifications.sql, replaced
-- in full since CREATE OR REPLACE FUNCTION requires the whole body).
CREATE OR REPLACE FUNCTION private.notify_social_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient uuid;
  actor uuid;
  notification_kind text;
  notification_message text;
  notification_url text;
  target_group_id uuid;
  target_post_id uuid;
  target_car_id uuid;
  target_question_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' OR TG_TABLE_NAME = 'post_comments' THEN
    SELECT p.user_id INTO recipient FROM public.posts p WHERE p.id = NEW.post_id;
    actor := NEW.user_id;
    notification_kind := CASE WHEN TG_TABLE_NAME = 'post_likes' THEN 'like' ELSE 'comment' END;
    target_post_id := NEW.post_id;
    notification_url := '/posts/' || NEW.post_id::text;

  ELSIF TG_TABLE_NAME = 'friendships' THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      recipient := NEW.recipient_id;
      actor := NEW.requester_id;
      notification_kind := 'friend_request';
      SELECT '/u/' || p.username INTO notification_url
      FROM public.profiles p WHERE p.user_id = NEW.requester_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      recipient := NEW.requester_id;
      actor := NEW.recipient_id;
      notification_kind := 'friend_accepted';
      SELECT '/u/' || p.username INTO notification_url
      FROM public.profiles p WHERE p.user_id = NEW.recipient_id;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'garage_car_likes' THEN
    SELECT g.user_id INTO recipient FROM public.garage_cars g WHERE g.id = NEW.garage_car_id;
    actor := NEW.user_id;
    notification_kind := 'car_like';
    target_car_id := NEW.garage_car_id;
    notification_url := '/garage';

  ELSIF TG_TABLE_NAME = 'garage_car_follows' THEN
    SELECT g.user_id INTO recipient FROM public.garage_cars g WHERE g.id = NEW.garage_car_id;
    actor := NEW.user_id;
    notification_kind := 'car_follow';
    target_car_id := NEW.garage_car_id;
    notification_url := '/garage';

  ELSIF TG_TABLE_NAME = 'answers' THEN
    SELECT q.user_id,
      '/cars/' || c.make_slug || '/' || c.model_slug || '/' || c.generation_slug ||
        '#question-' || q.id::text,
      q.id
    INTO recipient, notification_url, target_question_id
    FROM public.questions q
    JOIN public.cars c ON c.id = q.car_id
    WHERE q.id = NEW.question_id;
    actor := NEW.user_id;
    notification_kind := 'answer';

  ELSIF TG_TABLE_NAME = 'group_members' THEN
    target_group_id := NEW.group_id;
    SELECT '/groups/' || g.slug INTO notification_url
    FROM public.community_groups g WHERE g.id = NEW.group_id;

    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      INSERT INTO public.notifications(
        user_id, actor_id, kind, group_id, message, action_url
      )
      SELECT gm.user_id, NEW.user_id, 'join_request', NEW.group_id,
        'requested to join', notification_url
      FROM public.group_members gm
      WHERE gm.group_id = NEW.group_id
        AND gm.status = 'approved'
        AND gm.role IN ('owner', 'admin', 'moderator')
        AND gm.user_id <> NEW.user_id;
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      recipient := NEW.user_id;
      actor := (SELECT auth.uid());
      notification_kind := 'membership';
      notification_message := CASE NEW.status
        WHEN 'approved' THEN 'approved your request to join'
        WHEN 'rejected' THEN 'declined your request to join'
        WHEN 'banned' THEN 'removed you from'
        ELSE 'updated your membership in'
      END;
    ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      recipient := NEW.user_id;
      actor := (SELECT auth.uid());
      notification_kind := 'membership';
      notification_message := 'made you a ' || NEW.role || ' in';
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'posts' THEN
    IF TG_OP <> 'UPDATE' OR NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
      RETURN NEW;
    END IF;
    recipient := NEW.user_id;
    actor := (SELECT auth.uid());
    notification_kind := 'post_review';
    notification_message := CASE NEW.moderation_status
      WHEN 'published' THEN 'approved your post in'
      WHEN 'rejected' THEN 'did not approve your post in'
      ELSE 'updated your post in'
    END;
    target_group_id := NEW.group_id;
    target_post_id := NEW.id;
    SELECT '/groups/' || g.slug INTO notification_url
    FROM public.community_groups g WHERE g.id = NEW.group_id;

  ELSE
    RETURN NEW;
  END IF;

  IF recipient IS NULL OR actor IS NULL OR recipient = actor THEN
    RETURN NEW;
  END IF;

  IF private.users_are_blocked(recipient, actor) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = recipient
      AND n.actor_id = actor
      AND n.kind = notification_kind
      AND n.post_id IS NOT DISTINCT FROM target_post_id
      AND n.group_id IS NOT DISTINCT FROM target_group_id
      AND n.garage_car_id IS NOT DISTINCT FROM target_car_id
      AND n.question_id IS NOT DISTINCT FROM target_question_id
      AND n.created_at > now() - interval '1 minute'
  ) THEN
    INSERT INTO public.notifications(
      user_id,
      actor_id,
      kind,
      post_id,
      group_id,
      garage_car_id,
      question_id,
      message,
      action_url
    ) VALUES (
      recipient,
      actor,
      notification_kind,
      target_post_id,
      target_group_id,
      target_car_id,
      target_question_id,
      notification_message,
      notification_url
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_garage_car_follow
AFTER INSERT ON public.garage_car_follows
FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();

-- ============================================================
-- LEADERBOARD / RANK RPCs — net score (likes - dislikes), current cars only
-- ============================================================

-- Tier 3: individual cars, global. Tie-break: created_at ASC, id ASC.
CREATE OR REPLACE FUNCTION public.rank_garage_cars(result_limit integer DEFAULT 50, result_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, user_id uuid, username text, nickname text, make text, model text, photo_url text,
  likes_count int, dislikes_count int, followers_count int, net_score int, rank bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT id, user_id, username, nickname, make, model, photo_url, likes_count, dislikes_count, followers_count, net_score, rank
  FROM (
    SELECT
      g.id, g.user_id, p.username, g.nickname, g.make, g.model, g.photo_url,
      g.likes_count, g.dislikes_count, g.followers_count,
      g.likes_count - g.dislikes_count AS net_score,
      row_number() OVER (ORDER BY g.likes_count - g.dislikes_count DESC, g.created_at ASC, g.id ASC) AS rank
    FROM public.garage_cars g
    JOIN public.profiles p ON p.user_id = g.user_id
    WHERE g.ownership_status = 'current'
  ) ranked
  ORDER BY rank
  LIMIT greatest(0, least(result_limit, 200))
  OFFSET greatest(0, result_offset);
$$;
REVOKE ALL ON FUNCTION public.rank_garage_cars(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rank_garage_cars(integer, integer) TO anon, authenticated;

-- Single-car lookup for the per-card rank badge (cheap indexed scan, no
-- fetching hundreds of rows client-side).
CREATE OR REPLACE FUNCTION public.rank_garage_car(target_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT rank FROM (
    SELECT g.id, row_number() OVER (ORDER BY g.likes_count - g.dislikes_count DESC, g.created_at ASC, g.id ASC) AS rank
    FROM public.garage_cars g
    WHERE g.ownership_status = 'current'
  ) ranked
  WHERE ranked.id = target_id;
$$;
REVOKE ALL ON FUNCTION public.rank_garage_car(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rank_garage_car(uuid) TO anon, authenticated;

-- Tier 1: brands, ranked by total net score across all their current cars.
CREATE OR REPLACE FUNCTION public.rank_garage_car_brands(result_limit integer DEFAULT 50, result_offset integer DEFAULT 0)
RETURNS TABLE (make text, car_count bigint, total_likes bigint, total_dislikes bigint, net_score bigint, rank bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT make, car_count, total_likes, total_dislikes, net_score, rank
  FROM (
    SELECT
      g.make, count(*) AS car_count,
      sum(g.likes_count) AS total_likes, sum(g.dislikes_count) AS total_dislikes,
      sum(g.likes_count) - sum(g.dislikes_count) AS net_score,
      row_number() OVER (ORDER BY sum(g.likes_count) - sum(g.dislikes_count) DESC, g.make ASC) AS rank
    FROM public.garage_cars g
    WHERE g.ownership_status = 'current'
    GROUP BY g.make
  ) ranked
  ORDER BY rank
  LIMIT greatest(0, least(result_limit, 200))
  OFFSET greatest(0, result_offset);
$$;
REVOKE ALL ON FUNCTION public.rank_garage_car_brands(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rank_garage_car_brands(integer, integer) TO anon, authenticated;

-- Tier 2: brand+model, ranked by total net score. filter_make lets the UI
-- drill down from a selected brand into its models, or pass NULL for a
-- global "top models across all brands" view.
CREATE OR REPLACE FUNCTION public.rank_garage_car_models(filter_make text DEFAULT NULL, result_limit integer DEFAULT 50, result_offset integer DEFAULT 0)
RETURNS TABLE (make text, model text, car_count bigint, total_likes bigint, total_dislikes bigint, net_score bigint, rank bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT make, model, car_count, total_likes, total_dislikes, net_score, rank
  FROM (
    SELECT
      g.make, g.model, count(*) AS car_count,
      sum(g.likes_count) AS total_likes, sum(g.dislikes_count) AS total_dislikes,
      sum(g.likes_count) - sum(g.dislikes_count) AS net_score,
      row_number() OVER (ORDER BY sum(g.likes_count) - sum(g.dislikes_count) DESC, g.make ASC, g.model ASC) AS rank
    FROM public.garage_cars g
    WHERE g.ownership_status = 'current' AND (filter_make IS NULL OR g.make = filter_make)
    GROUP BY g.make, g.model
  ) ranked
  ORDER BY rank
  LIMIT greatest(0, least(result_limit, 200))
  OFFSET greatest(0, result_offset);
$$;
REVOKE ALL ON FUNCTION public.rank_garage_car_models(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rank_garage_car_models(text, integer, integer) TO anon, authenticated;

-- ============================================================
-- MARKETPLACE: link listings to a specific garage car
-- ============================================================
ALTER TABLE public.listings
  ADD COLUMN garage_car_id uuid REFERENCES public.garage_cars(id) ON DELETE SET NULL,
  ADD COLUMN show_car_stats boolean NOT NULL DEFAULT false;
CREATE INDEX listings_garage_car_id_idx ON public.listings(garage_car_id);

-- Defense in depth: a listing's garage_car_id must belong to its own
-- seller (the client only ever offers the seller's own cars).
CREATE OR REPLACE FUNCTION private.validate_listing_garage_car()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.garage_car_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.garage_cars g
    WHERE g.id = NEW.garage_car_id AND g.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'garage_car_id must belong to the listing owner';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_listing_garage_car_before_write
BEFORE INSERT OR UPDATE OF garage_car_id, user_id ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.validate_listing_garage_car();

COMMIT;
