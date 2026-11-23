-- Business discovery (Phase 3): lets any member search and filter local and nationwide car
-- businesses. Requires 0080 and 0081. Additive and reversible (0082_business_discovery_down.sql).
--
-- * search_businesses(): one ranked, paged search by words, category, area and quality filters.
--   Only approved, non-suspended businesses are ever returned (it relies on the same RLS and
--   status rules as everything else, and checks status itself too).
-- * Ranking is by relevance, then how close the business is to the member's area, then trust.
--   Payment never changes the order: Business Pro businesses are only flagged, and the app puts
--   at most two of them at the top of a page, clearly labelled "Promoted".
-- * "Open now" uses the regular weekly hours in UK time; bank holidays are not applied, and a
--   business that hasn't set hours is not shown by that filter.
-- * Distance is by area (same postcode district, same wider area, places it covers, same town),
--   not miles. Radius search needs coordinates for every business and is a later step.

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS serves_nationwide boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.search_businesses(
  p_query text DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_area text DEFAULT NULL,
  p_scope text DEFAULT 'any',
  p_min_rating numeric DEFAULT 0,
  p_trusted_only boolean DEFAULT false,
  p_open_now boolean DEFAULT false,
  p_sort text DEFAULT 'best',
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  -- Categories implied by the words typed (e.g. "mot" -> mot_centre): a soft boost, not a filter.
  p_intent text[] DEFAULT NULL
) RETURNS TABLE (
  id uuid, name text, category text, description text, town text, postcode_district text, address text,
  logo_url text, verified boolean, rating_avg numeric, reviews_count integer, rating_score numeric,
  trust_level text, serves_nationwide boolean, promoted boolean, match_tier integer,
  opening_hours jsonb, services text[], total_count bigint
)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH params AS (
    SELECT
      nullif(btrim(coalesce(p_query, '')), '') AS q,
      nullif(upper(btrim(coalesce(p_area, ''))), '') AS area,
      nullif(lower(btrim(coalesce(p_area, ''))), '') AS area_lc,
      lower(to_char(now() AT TIME ZONE 'Europe/London', 'Dy')) AS dow,
      (now() AT TIME ZONE 'Europe/London')::time AS now_time
  ), scored AS (
    SELECT
      b.*,
      CASE
        WHEN pr.area IS NULL THEN 5
        WHEN b.postcode_district = pr.area THEN 0
        WHEN pr.area ~ '^[A-Z]{1,2}[0-9]' AND b.postcode_district LIKE regexp_replace(pr.area, '[0-9].*$', '') || '%' THEN 1
        WHEN pr.area = ANY (b.covers_areas)
          OR (pr.area ~ '^[A-Z]{1,2}[0-9]' AND EXISTS (
                SELECT 1 FROM unnest(b.covers_areas) c WHERE c LIKE regexp_replace(pr.area, '[0-9].*$', '') || '%')) THEN 2
        WHEN lower(coalesce(b.town, '')) = pr.area_lc OR lower(coalesce(b.town, '')) LIKE pr.area_lc || '%' THEN 3
        WHEN b.serves_nationwide THEN 4
        ELSE 6
      END AS area_tier,
      CASE
        WHEN pr.q IS NULL THEN 0
        WHEN b.name ILIKE '%' || pr.q || '%' THEN 3
        WHEN p_intent IS NOT NULL AND b.category = ANY (p_intent) THEN 2
        WHEN array_to_string(b.services, ' ') ILIKE '%' || pr.q || '%' THEN 2
        WHEN b.description ILIKE '%' || pr.q || '%' OR coalesce(b.town, '') ILIKE '%' || pr.q || '%' THEN 1
        ELSE -1
      END AS relevance,
      CASE WHEN jsonb_typeof(b.opening_hours -> pr.dow) = 'object'
             AND (b.opening_hours -> pr.dow ->> 'open') ~ '^[0-2][0-9]:[0-5][0-9]$'
             AND (b.opening_hours -> pr.dow ->> 'close') ~ '^[0-2][0-9]:[0-5][0-9]$'
           THEN pr.now_time >= (b.opening_hours -> pr.dow ->> 'open')::time
                AND pr.now_time < (b.opening_hours -> pr.dow ->> 'close')::time
           ELSE false END AS open_now
    FROM public.businesses b CROSS JOIN params pr
    WHERE b.status = 'active'
  ), filtered AS (
    SELECT s.* FROM scored s CROSS JOIN params pr
    WHERE (pr.q IS NULL OR s.relevance >= 0)
      AND (p_categories IS NULL OR cardinality(p_categories) = 0 OR s.category = ANY (p_categories))
      AND (p_scope <> 'local' OR pr.area IS NULL OR s.area_tier <= 4)
      AND (p_scope <> 'national' OR s.serves_nationwide)
      AND (coalesce(p_min_rating, 0) <= 0 OR (s.reviews_count > 0 AND s.rating_avg >= p_min_rating))
      AND (NOT coalesce(p_trusted_only, false) OR s.trust_level = 'trusted')
      AND (NOT coalesce(p_open_now, false) OR s.open_now)
  )
  SELECT f.id, f.name, f.category, f.description, f.town, f.postcode_district, f.address,
    f.logo_url, f.verified, f.rating_avg, f.reviews_count, f.rating_score, f.trust_level,
    f.serves_nationwide, (f.promoted_until IS NOT NULL AND f.promoted_until > now()) AS promoted,
    f.area_tier AS match_tier, f.opening_hours, f.services, count(*) OVER () AS total_count
  FROM filtered f
  ORDER BY
    CASE WHEN p_sort = 'rating' THEN NULL ELSE f.area_tier END ASC NULLS LAST,
    CASE WHEN p_sort = 'rating' THEN f.rating_score END DESC NULLS LAST,
    f.relevance DESC,
    f.rating_score DESC,
    f.verified DESC,
    f.reviews_count DESC,
    f.created_at ASC,
    f.id ASC
  LIMIT least(greatest(coalesce(p_limit, 24), 1), 50)
  OFFSET greatest(coalesce(p_offset, 0), 0)
$$;
GRANT EXECUTE ON FUNCTION public.search_businesses(text, text[], text, text, numeric, boolean, boolean, text, integer, integer, text[])
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.business_discovery_ready() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    public.business_trust_ready()
    AND (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name = 'serves_nationwide') = 1
    AND (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'search_businesses') = 1
    AND EXISTS (SELECT 1 FROM public.schema_features WHERE name = 'business_discovery')
$$;
GRANT EXECUTE ON FUNCTION public.business_discovery_ready() TO anon, authenticated;

INSERT INTO public.schema_features (name, version) VALUES ('business_discovery', 1)
ON CONFLICT (name) DO UPDATE SET version = EXCLUDED.version, applied_at = now();
