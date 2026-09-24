-- Replaces mutual friend requests with one-way profile follows and adds
-- private, first-party profile analytics. Existing connections are preserved:
-- accepted friendships become mutual follows and pending requests become a
-- follow from the requester to the recipient.
BEGIN;

CREATE TABLE public.profile_follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT profile_follows_not_self CHECK (follower_id <> followed_id)
);

CREATE INDEX profile_follows_followed_created_idx
  ON public.profile_follows(followed_id, created_at DESC);
CREATE INDEX profile_follows_follower_created_idx
  ON public.profile_follows(follower_id, created_at DESC);

GRANT SELECT ON public.profile_follows TO anon, authenticated;
GRANT INSERT, DELETE ON public.profile_follows TO authenticated;
GRANT ALL ON public.profile_follows TO service_role;
ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profile follows are viewable by everyone"
ON public.profile_follows FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Active users follow as themselves"
ON public.profile_follows FOR INSERT TO authenticated
WITH CHECK (
  follower_id = (SELECT auth.uid())
  AND private.is_active_account((SELECT auth.uid()))
  AND private.is_active_account(followed_id)
  AND NOT private.users_are_blocked(follower_id, followed_id)
);

CREATE POLICY "Users remove their own follows"
ON public.profile_follows FOR DELETE TO authenticated
USING (follower_id = (SELECT auth.uid()));

INSERT INTO public.profile_follows(follower_id, followed_id, created_at)
SELECT requester_id, recipient_id, created_at
FROM public.friendships
ON CONFLICT DO NOTHING;

INSERT INTO public.profile_follows(follower_id, followed_id, created_at)
SELECT recipient_id, requester_id, created_at
FROM public.friendships
WHERE status = 'accepted'
ON CONFLICT DO NOTHING;

CREATE FUNCTION private.is_following(viewer_id uuid, author_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT viewer_id IS NOT NULL
    AND author_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profile_follows f
      WHERE f.follower_id = viewer_id AND f.followed_id = author_id
    );
$$;
REVOKE ALL ON FUNCTION private.is_following(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_following(uuid, uuid) TO anon, authenticated;

-- The legacy enum value remains "friends" so old rows and generated clients
-- keep working. It now means followers-only visibility.
CREATE OR REPLACE FUNCTION private.can_view_post(check_post_id uuid, viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = check_post_id
      AND (
        private.is_revmate_admin(viewer_id)
        OR (
          private.is_active_account(p.user_id)
          AND (
            viewer_id IS NULL
            OR (
              private.is_active_account(viewer_id)
              AND NOT private.users_are_blocked(p.user_id, viewer_id)
            )
          )
          AND (p.group_id IS NULL OR private.group_access(p.group_id))
          AND (
            p.moderation_status = 'published'
            OR p.user_id = viewer_id
            OR private.group_rank(p.group_id) >= 2
          )
          AND (
            p.group_id IS NOT NULL
            OR p.audience = 'public'
            OR (
              p.audience = 'friends'
              AND viewer_id IS NOT NULL
              AND (p.user_id = viewer_id OR private.is_following(viewer_id, p.user_id))
            )
          )
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Visible posts are viewable" ON public.posts;
CREATE POLICY "Visible posts are viewable"
ON public.posts FOR SELECT TO anon, authenticated
USING (private.can_view_post(id, (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.community_feed(
  filter_scope text DEFAULT 'all',
  filter_car uuid DEFAULT NULL,
  filter_category text DEFAULT 'all',
  page_offset integer DEFAULT 0
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.posts p
  WHERE p.moderation_status = 'published'
    AND (filter_category = 'all' OR p.category::text = filter_category)
    AND CASE
      WHEN filter_scope = 'friends' THEN
        p.group_id IS NULL
        AND (SELECT auth.uid()) IS NOT NULL
        AND (
          p.user_id = (SELECT auth.uid())
          OR private.is_following((SELECT auth.uid()), p.user_id)
        )
      WHEN filter_scope = 'my_groups' THEN
        p.audience = 'public'
        AND p.group_id IS NOT NULL
        AND (SELECT auth.uid()) IS NOT NULL
        AND private.group_rank(p.group_id) >= 1
      WHEN filter_scope IN ('my_car', 'same_brand') THEN
        p.group_id IS NULL
        AND p.audience = 'public'
        AND EXISTS (
          SELECT 1
          FROM public.garage_cars posted
          JOIN public.garage_cars owned
            ON lower(btrim(owned.make)) = lower(btrim(posted.make))
          WHERE posted.id = p.posted_as_garage_car_id
            AND owned.user_id = (SELECT auth.uid())
            AND owned.ownership_status = 'current'
            AND (filter_car IS NULL OR owned.id = filter_car)
            AND (
              filter_scope = 'same_brand'
              OR lower(btrim(owned.model)) = lower(btrim(posted.model))
            )
        )
      WHEN filter_scope = 'popular' THEN
        p.group_id IS NULL
        AND p.audience = 'public'
        AND p.created_at > now() - interval '7 days'
      WHEN filter_scope = 'all' THEN
        p.group_id IS NULL
        AND p.audience = 'public'
      ELSE false
    END
  ORDER BY
    CASE WHEN filter_scope = 'popular' THEN p.likes_count ELSE 0 END DESC,
    p.created_at DESC,
    p.id DESC
  LIMIT 30 OFFSET greatest(0, least(page_offset, 10000));
$$;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment', 'like', 'join_request', 'membership', 'friend_request',
    'friend_accepted', 'car_like', 'answer', 'post_review', 'app_update',
    'message', 'car_follow', 'profile_follow'
  )
);

CREATE FUNCTION private.notify_profile_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE target_url text;
BEGIN
  IF NEW.follower_id = NEW.followed_id
    OR private.users_are_blocked(NEW.follower_id, NEW.followed_id) THEN
    RETURN NEW;
  END IF;
  SELECT '/u/' || p.username INTO target_url
  FROM public.profiles p WHERE p.user_id = NEW.follower_id;
  INSERT INTO public.notifications(user_id, actor_id, kind, action_url)
  VALUES (NEW.followed_id, NEW.follower_id, 'profile_follow', target_url);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_profile_follow() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_profile_follow
AFTER INSERT ON public.profile_follows
FOR EACH ROW EXECUTE FUNCTION private.notify_profile_follow();

CREATE TABLE public.profile_views (
  viewed_user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  viewed_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (viewed_user_id, viewer_id, viewed_on),
  CONSTRAINT profile_views_not_self CHECK (viewed_user_id <> viewer_id)
);
CREATE INDEX profile_views_owner_date_idx ON public.profile_views(viewed_user_id, viewed_on DESC);
GRANT SELECT ON public.profile_views TO authenticated;
GRANT ALL ON public.profile_views TO service_role;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their own profile analytics"
ON public.profile_views FOR SELECT TO authenticated
USING (viewed_user_id = (SELECT auth.uid()));

CREATE FUNCTION public.record_profile_view(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
  IF actor IS NULL OR actor = target_user_id THEN RETURN; END IF;
  IF NOT private.is_active_account(actor)
    OR NOT private.is_active_account(target_user_id)
    OR private.users_are_blocked(actor, target_user_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.profile_views(viewed_user_id, viewer_id)
  VALUES (target_user_id, actor)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.record_profile_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_profile_view(uuid) TO authenticated;

CREATE FUNCTION public.account_analytics()
RETURNS TABLE (
  followers_total bigint,
  following_total bigint,
  posts_total bigint,
  profile_views_7d bigint,
  profile_views_30d bigint,
  new_followers_30d bigint,
  likes_received_30d bigint,
  comments_received_30d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT count(*) FROM public.profile_follows f WHERE f.followed_id = (SELECT auth.uid())),
    (SELECT count(*) FROM public.profile_follows f WHERE f.follower_id = (SELECT auth.uid())),
    (SELECT count(*) FROM public.posts p WHERE p.user_id = (SELECT auth.uid())),
    (SELECT count(*) FROM public.profile_views v WHERE v.viewed_user_id = (SELECT auth.uid()) AND v.viewed_on >= current_date - 6),
    (SELECT count(*) FROM public.profile_views v WHERE v.viewed_user_id = (SELECT auth.uid()) AND v.viewed_on >= current_date - 29),
    (SELECT count(*) FROM public.profile_follows f WHERE f.followed_id = (SELECT auth.uid()) AND f.created_at >= now() - interval '30 days'),
    (SELECT count(*) FROM public.post_likes l JOIN public.posts p ON p.id = l.post_id WHERE p.user_id = (SELECT auth.uid()) AND l.created_at >= now() - interval '30 days'),
    (SELECT count(*) FROM public.post_comments c JOIN public.posts p ON p.id = c.post_id WHERE p.user_id = (SELECT auth.uid()) AND c.created_at >= now() - interval '30 days');
$$;
REVOKE ALL ON FUNCTION public.account_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.account_analytics() TO authenticated;

CREATE OR REPLACE FUNCTION private.clean_up_blocked_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE (requester_id = NEW.blocker_id AND recipient_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND recipient_id = NEW.blocker_id);
  DELETE FROM public.profile_follows
  WHERE (follower_id = NEW.blocker_id AND followed_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND followed_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

COMMIT;
