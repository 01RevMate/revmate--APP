CREATE OR REPLACE FUNCTION public.community_feed(filter_scope text DEFAULT 'all'::text, filter_car uuid DEFAULT NULL::uuid, filter_category text DEFAULT 'all'::text, page_offset integer DEFAULT 0)
 RETURNS SETOF posts
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$;