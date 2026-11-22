-- Fault search that scales and matches words (growth foundations, task 4).
--
-- Before: the app pulled the newest 300 fault posts site-wide and filtered make/model in the
-- browser, so older fixes vanished once there were more than 300, and keyword search only matched
-- an exact phrase.
--
-- Now: search_issue_posts() filters in the database, matches words with Postgres full-text search
-- ("leak footwell" finds "water leak in the footwell"), ranks fixed posts first, then relevance,
-- then newest, and pages with limit/offset.
--
-- SECURITY INVOKER: it runs as the caller, so every existing row-level rule still applies (a
-- signed-out visitor only sees adults' public posts; private groups and blocked accounts stay out).
-- Additive and reversible (0083_search_issue_posts_down.sql). Nothing is dropped.

-- Word search over the post text and the fix, only for fault posts.
CREATE INDEX IF NOT EXISTS posts_issue_fts_idx ON public.posts
  USING gin (to_tsvector('english', coalesce(body, '') || ' ' || coalesce(issue_fix, '')))
  WHERE issue_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.search_issue_posts(
  p_make text DEFAULT NULL,
  p_model text DEFAULT NULL,
  p_system text DEFAULT NULL,
  p_resolved_only boolean DEFAULT false,
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
) RETURNS SETOF public.posts
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH q AS (
    SELECT CASE WHEN nullif(btrim(coalesce(p_query, '')), '') IS NULL THEN NULL
                ELSE websearch_to_tsquery('english', btrim(p_query)) END AS tsq
  )
  SELECT p.*
  FROM public.posts p
  LEFT JOIN public.garage_cars g ON g.id = p.posted_as_garage_car_id
  LEFT JOIN public.cars c ON c.id = p.car_id
  CROSS JOIN q
  WHERE p.issue_status IS NOT NULL
    AND p.group_id IS NULL
    AND (p_system IS NULL OR p.issue_system = p_system)
    AND (NOT coalesce(p_resolved_only, false) OR p.issue_status = 'resolved')
    -- Same precedence as postCar() in the app: tagged make/model, then the garage car it was
    -- posted as, then the catalogue car. Case-insensitive.
    AND (nullif(btrim(coalesce(p_make, '')), '') IS NULL
         OR lower(btrim(coalesce(p.tagged_make, g.make, c.make, ''))) = lower(btrim(p_make)))
    AND (nullif(btrim(coalesce(p_model, '')), '') IS NULL
         OR lower(btrim(coalesce(p.tagged_model, g.model, c.model, ''))) = lower(btrim(p_model)))
    AND (q.tsq IS NULL
         OR to_tsvector('english', coalesce(p.body, '') || ' ' || coalesce(p.issue_fix, '')) @@ q.tsq)
  ORDER BY
    (p.issue_status = 'resolved') DESC,
    CASE WHEN q.tsq IS NULL THEN 0
         ELSE ts_rank(to_tsvector('english', coalesce(p.body, '') || ' ' || coalesce(p.issue_fix, '')), q.tsq) END DESC,
    p.created_at DESC,
    p.id DESC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 50)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;
GRANT EXECUTE ON FUNCTION public.search_issue_posts(text, text, text, boolean, text, integer, integer)
  TO anon, authenticated;
