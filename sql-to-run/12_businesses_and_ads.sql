-- STEP 12 — Local businesses, member reviews & reports, and the ads manager
-- Copy of drizzle/migrations/0046_businesses_and_ads.sql
-- Run the whole file once, after step 11.

-- Local car businesses, member reviews and an admin-run ads manager.
-- Run after 0045_car_care_diagnostics_feed.sql.
--
-- * businesses: mobile mechanics, bodywork, EV charger installers,
--   detailers, dealers… added and verified by admins (owners can be linked).
-- * business_reviews: 1–5 stars from members, one per person per business;
--   business_reports flag bad actors to admins. Ratings and counts are kept
--   up to date by triggers and can't be edited by hand.
-- * ad_campaigns: sponsored cards admins place in the feed, targeted by
--   area (postcode district or town) and car type (fuel, brand tier), with
--   impression and click counts.
-- * member_areas: an optional postcode district (e.g. LS6) members can set
--   for local offers. Only the member can see it.
-- * listings.business_id: lets a trade seller's listings show their
--   business and rating, ready for dealers.

BEGIN;

-- Kept in its own table (profiles are public) so only the member can see it.
CREATE TABLE IF NOT EXISTS public.member_areas (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  home_area text NOT NULL CHECK (home_area ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.member_areas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_areas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_areas TO authenticated;
GRANT ALL ON public.member_areas TO service_role;
DROP POLICY IF EXISTS member_areas_own ON public.member_areas;
CREATE POLICY member_areas_own ON public.member_areas FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  category text NOT NULL CHECK (category IN (
    'mobile_mechanic', 'garage', 'bodywork', 'ev_charger_installer', 'detailing', 'tyres',
    'tuning', 'dealer', 'parts', 'recovery', 'mot_centre', 'insurance', 'other')),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  town text CHECK (town IS NULL OR char_length(town) <= 60),
  postcode_district text CHECK (postcode_district IS NULL OR postcode_district ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?$'),
  -- Districts it covers (mobile services); empty means just its own area.
  covers_areas text[] NOT NULL DEFAULT '{}',
  website text CHECK (website IS NULL OR website ~ '^https://'),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 30),
  logo_url text CHECK (logo_url IS NULL OR logo_url ~ '^https://'),
  owner_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  rating_avg numeric(3, 2) NOT NULL DEFAULT 0,
  reviews_count int NOT NULL DEFAULT 0,
  reports_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS businesses_category_area_idx ON public.businesses (status, category, postcode_district);

CREATE TABLE IF NOT EXISTS public.business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.business_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('scam', 'poor_work', 'overcharging', 'fake_reviews', 'unsafe', 'other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, reporter_id)
);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL;

-- Counters are only changed by these triggers.
CREATE OR REPLACE FUNCTION private.guard_business() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.rating_avg := 0; NEW.reviews_count := 0; NEW.reports_count := 0;
    ELSE
      NEW.rating_avg := OLD.rating_avg; NEW.reviews_count := OLD.reviews_count;
      NEW.reports_count := OLD.reports_count;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_business ON public.businesses;
CREATE TRIGGER guard_business BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION private.guard_business();

CREATE OR REPLACE FUNCTION private.refresh_business_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid := coalesce(NEW.business_id, OLD.business_id);
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.businesses b SET
    reviews_count = (SELECT count(*) FROM public.business_reviews r WHERE r.business_id = target),
    rating_avg = coalesce((SELECT round(avg(r.rating)::numeric, 2) FROM public.business_reviews r WHERE r.business_id = target), 0),
    reports_count = (SELECT count(*) FROM public.business_reports r WHERE r.business_id = target AND r.status <> 'dismissed')
  WHERE b.id = target;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS refresh_business_stats_reviews ON public.business_reviews;
CREATE TRIGGER refresh_business_stats_reviews AFTER INSERT OR UPDATE OR DELETE ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION private.refresh_business_stats();
DROP TRIGGER IF EXISTS refresh_business_stats_reports ON public.business_reports;
CREATE TRIGGER refresh_business_stats_reports AFTER INSERT OR UPDATE OR DELETE ON public.business_reports
  FOR EACH ROW EXECUTE FUNCTION private.refresh_business_stats();

CREATE OR REPLACE FUNCTION private.stamp_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.business_id := OLD.business_id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS stamp_review ON public.business_reviews;
CREATE TRIGGER stamp_review BEFORE INSERT OR UPDATE ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION private.stamp_review();
REVOKE ALL ON FUNCTION private.guard_business(), private.refresh_business_stats(), private.stamp_review()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.businesses, public.business_reviews, public.business_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.businesses, public.business_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.business_reports TO authenticated;
GRANT ALL ON public.businesses, public.business_reviews, public.business_reports TO service_role;

DROP POLICY IF EXISTS businesses_read ON public.businesses;
CREATE POLICY businesses_read ON public.businesses FOR SELECT
  USING (status = 'active' OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS businesses_admin_write ON public.businesses;
CREATE POLICY businesses_admin_write ON public.businesses FOR ALL TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS reviews_read ON public.business_reviews;
CREATE POLICY reviews_read ON public.business_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS reviews_insert ON public.business_reviews;
CREATE POLICY reviews_insert ON public.business_reviews FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid()))
  -- No reviewing your own business.
  AND NOT EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.status = 'active')
);
DROP POLICY IF EXISTS reviews_update_own ON public.business_reviews;
CREATE POLICY reviews_update_own ON public.business_reviews FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS reviews_delete ON public.business_reviews;
CREATE POLICY reviews_delete ON public.business_reviews FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS reports_read ON public.business_reports;
CREATE POLICY reports_read ON public.business_reports FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS reports_insert ON public.business_reports;
CREATE POLICY reports_insert ON public.business_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())) AND status = 'open');
DROP POLICY IF EXISTS reports_admin_update ON public.business_reports;
CREATE POLICY reports_admin_update ON public.business_reports FOR UPDATE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

-- ============================================================
-- ADS MANAGER
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 100),
  headline text NOT NULL CHECK (char_length(btrim(headline)) BETWEEN 2 AND 90),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 300),
  image_url text CHECK (image_url IS NULL OR image_url ~ '^https://'),
  cta_label text NOT NULL DEFAULT 'Find out more' CHECK (char_length(btrim(cta_label)) BETWEEN 1 AND 30),
  cta_url text NOT NULL CHECK (cta_url ~ '^(/[^/]|https://)'),
  placement text NOT NULL DEFAULT 'feed' CHECK (placement IN ('feed', 'marketplace', 'both')),
  -- Postcode districts or area prefixes (LS, LS6, M); empty = all of the UK.
  target_areas text[] NOT NULL DEFAULT '{}',
  target_fuel text CHECK (target_fuel IS NULL OR target_fuel IN ('petrol', 'diesel', 'electric', 'hybrid')),
  target_segment text CHECK (target_segment IS NULL OR target_segment IN ('supercar', 'luxury', 'premium', 'performance', 'mainstream', 'value')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE OR REPLACE FUNCTION private.guard_ad_campaign() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid()); NEW.impressions := 0; NEW.clicks := 0;
  ELSIF current_setting('revmate.counter_update', true) IS DISTINCT FROM 'on' THEN
    NEW.impressions := OLD.impressions; NEW.clicks := OLD.clicks; NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_ad_campaign ON public.ad_campaigns;
CREATE TRIGGER guard_ad_campaign BEFORE INSERT OR UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION private.guard_ad_campaign();
REVOKE ALL ON FUNCTION private.guard_ad_campaign() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_campaigns FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
DROP POLICY IF EXISTS ads_admin ON public.ad_campaigns;
CREATE POLICY ads_admin ON public.ad_campaigns FOR ALL TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())))
  WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

-- The live ads that match the signed-in member: their area (from
-- home_area) and their cars. Suspended businesses' ads never show.
CREATE OR REPLACE FUNCTION public.ads_for_me(for_placement text DEFAULT 'feed', result_limit integer DEFAULT 5)
RETURNS TABLE (id uuid, headline text, body text, image_url text, cta_label text, cta_url text,
  business_id uuid, business_name text, business_rating numeric, business_reviews int, business_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH me AS (
    SELECT (SELECT ma.home_area FROM public.member_areas ma WHERE ma.user_id = p.user_id) AS home_area,
      (SELECT array_agg(DISTINCT g.fuel_type::text) FROM public.garage_cars g
        WHERE g.user_id = p.user_id AND g.ownership_status = 'current') AS fuels,
      (SELECT array_agg(DISTINCT s.segment) FROM public.garage_cars g
        JOIN public.vehicle_make_segments s ON s.make = lower(btrim(g.make))
        WHERE g.user_id = p.user_id AND g.ownership_status = 'current') AS segments
    FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())
  )
  SELECT a.id, a.headline, a.body, a.image_url, a.cta_label, a.cta_url,
    b.id, b.name, b.rating_avg, b.reviews_count, b.verified
  FROM public.ad_campaigns a
  LEFT JOIN public.businesses b ON b.id = a.business_id
  LEFT JOIN me ON true
  WHERE a.active AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
    AND (a.placement = for_placement OR a.placement = 'both')
    AND (a.business_id IS NULL OR b.status = 'active')
    AND (cardinality(a.target_areas) = 0 OR EXISTS (
      SELECT 1 FROM unnest(a.target_areas) t
      WHERE me.home_area IS NOT NULL AND me.home_area LIKE upper(t) || '%'))
    AND (a.target_fuel IS NULL OR a.target_fuel = ANY(coalesce(me.fuels, '{}')))
    AND (a.target_segment IS NULL OR a.target_segment = ANY(coalesce(me.segments, '{}')))
  ORDER BY (cardinality(a.target_areas) > 0) DESC, random()
  LIMIT least(greatest(result_limit, 1), 10)
$$;
GRANT EXECUTE ON FUNCTION public.ads_for_me(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ad_event(target_ad uuid, event text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR event NOT IN ('impression', 'click') THEN RETURN; END IF;
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.ad_campaigns SET
    impressions = impressions + CASE WHEN event = 'impression' THEN 1 ELSE 0 END,
    clicks = clicks + CASE WHEN event = 'click' THEN 1 ELSE 0 END
  WHERE id = target_ad AND active;
  PERFORM set_config('revmate.counter_update', 'off', true);
END; $$;
REVOKE ALL ON FUNCTION public.record_ad_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text) TO authenticated;

COMMIT;
