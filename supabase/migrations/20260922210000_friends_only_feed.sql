BEGIN;

CREATE TYPE public.post_audience AS ENUM ('public', 'friends');

ALTER TABLE public.posts
  ADD COLUMN audience public.post_audience NOT NULL DEFAULT 'public';

CREATE INDEX posts_friends_audience_created_idx
  ON public.posts (user_id, created_at DESC)
  WHERE audience = 'friends' AND group_id IS NULL;

CREATE FUNCTION private.are_friends(first_user uuid, second_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT first_user IS NOT NULL
    AND second_user IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = first_user AND f.recipient_id = second_user)
          OR (f.requester_id = second_user AND f.recipient_id = first_user)
        )
    );
$$;

REVOKE ALL ON FUNCTION private.are_friends(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.are_friends(uuid, uuid) TO anon, authenticated;

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
              AND (
                p.user_id = viewer_id
                OR private.are_friends(p.user_id, viewer_id)
              )
            )
          )
        )
      )
  );
$$;

DROP POLICY "Visible posts are viewable" ON public.posts;
CREATE POLICY "Visible posts are viewable"
ON public.posts FOR SELECT TO anon, authenticated
USING (
  private.is_revmate_admin((SELECT auth.uid()))
  OR (
    private.is_active_account(user_id)
    AND (
      (SELECT auth.uid()) IS NULL
      OR (
        private.is_active_account((SELECT auth.uid()))
        AND NOT private.users_are_blocked(user_id, (SELECT auth.uid()))
      )
    )
    AND (group_id IS NULL OR private.group_access(group_id))
    AND (
      moderation_status = 'published'
      OR user_id = (SELECT auth.uid())
      OR private.group_rank(group_id) >= 2
    )
    AND (
      group_id IS NOT NULL
      OR audience = 'public'
      OR (
        audience = 'friends'
        AND (SELECT auth.uid()) IS NOT NULL
        AND (
          user_id = (SELECT auth.uid())
          OR private.are_friends(user_id, (SELECT auth.uid()))
        )
      )
    )
  )
);

CREATE FUNCTION private.enforce_post_audience()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.group_id IS NOT NULL AND NEW.audience <> 'public' THEN
    RAISE EXCEPTION 'Group posts use group visibility';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.audience IS DISTINCT FROM OLD.audience THEN
    RAISE EXCEPTION 'Post audience cannot be changed after publishing';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_post_audience() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_post_audience
BEFORE INSERT OR UPDATE OF audience, group_id ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.enforce_post_audience();

DROP POLICY group_image_upload ON storage.objects;
CREATE POLICY group_image_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'group-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.user_id = (SELECT auth.uid())
      AND (
        (p.group_id IS NOT NULL AND private.group_rank(p.group_id) >= 1)
        OR (p.group_id IS NULL AND p.audience = 'friends')
      )
  )
);

CREATE OR REPLACE FUNCTION private.check_post_image()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE p public.posts;
BEGIN
  SELECT * INTO p FROM public.posts WHERE id = NEW.post_id FOR UPDATE;
  IF NOT private.is_active_account((SELECT auth.uid())) OR p.user_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Upload to your own post';
  END IF;
  IF (SELECT count(*) FROM public.post_images WHERE post_id = NEW.post_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum five images per post';
  END IF;
  IF (p.group_id IS NOT NULL OR p.audience = 'friends')
    AND (
      (p.group_id IS NOT NULL AND private.group_rank(p.group_id) < 1)
      OR NEW.image_url NOT LIKE 'group-images:' || p.user_id::text || '/' || p.id::text || '/%'
    ) THEN
    RAISE EXCEPTION 'Private photos must use protected storage';
  END IF;
  RETURN NEW;
END;
$$;

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
        AND p.audience = 'friends'
        AND (SELECT auth.uid()) IS NOT NULL
        AND (
          p.user_id = (SELECT auth.uid())
          OR private.are_friends(p.user_id, (SELECT auth.uid()))
        )
      WHEN filter_scope = 'my_groups' THEN
        p.audience = 'public'
        AND EXISTS (
          SELECT 1 FROM public.group_members gm
          WHERE gm.group_id = p.group_id
            AND gm.user_id = (SELECT auth.uid())
            AND gm.status = 'approved'
        )
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

COMMIT;
