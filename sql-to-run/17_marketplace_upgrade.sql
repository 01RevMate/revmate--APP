-- RevMate SQL step 17 — marketplace upgrade (saved-search alerts, offers, parts details,
-- distance search, running costs, seller reviews and seller stats).
-- Copy of drizzle/migrations/0051_marketplace_upgrade.sql. Safe to run more than once.

-- Marketplace upgrade: parts details (category, condition, postage),
-- distance search, running costs, saved searches with alerts, offers,
-- seller reviews after a RevMate sale and seller trust stats.
-- Run after 0050. Everything is additive — no listings, messages or
-- profiles are deleted or changed.

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
    'mot_reminder', 'tax_reminder', 'issue_resolved', 'resolve_prompt',
    'search_alert', 'offer', 'offer_update', 'review_request'
  )
);

-- ============================================================
-- LISTING COLUMNS
-- ============================================================
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS part_category text CHECK (part_category IS NULL OR part_category IN (
    'wheels_tyres', 'exhaust', 'lighting', 'interior', 'audio', 'body', 'performance',
    'engine', 'suspension_brakes', 'electrical', 'detailing', 'tools', 'accessories', 'other')),
  ADD COLUMN IF NOT EXISTS item_condition text
    CHECK (item_condition IS NULL OR item_condition IN ('new', 'used', 'refurbished')),
  ADD COLUMN IF NOT EXISTS collection_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS postage_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS postage_price numeric
    CHECK (postage_price IS NULL OR (postage_price >= 0 AND postage_price <= 1000)),
  -- Only the first half of a postcode (e.g. LS6) and its rough centre.
  ADD COLUMN IF NOT EXISTS location_district text
    CHECK (location_district IS NULL OR location_district ~ '^[A-Z]{1,2}[0-9][0-9A-Z]?$'),
  ADD COLUMN IF NOT EXISTS location_lat double precision
    CHECK (location_lat IS NULL OR location_lat BETWEEN 49 AND 61),
  ADD COLUMN IF NOT EXISTS location_lng double precision
    CHECK (location_lng IS NULL OR location_lng BETWEEN -9 AND 2.5),
  ADD COLUMN IF NOT EXISTS co2_gkm int CHECK (co2_gkm IS NULL OR co2_gkm BETWEEN 0 AND 600),
  ADD COLUMN IF NOT EXISTS mpg numeric CHECK (mpg IS NULL OR (mpg > 0 AND mpg <= 300)),
  ADD COLUMN IF NOT EXISTS insurance_group int
    CHECK (insurance_group IS NULL OR insurance_group BETWEEN 1 AND 50),
  ADD COLUMN IF NOT EXISTS open_to_offers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS listings_buyer_idx ON public.listings(buyer_id) WHERE buyer_id IS NOT NULL;

-- Rounds the location to ~1 km and keeps the buyer only settable through
-- set_listing_buyer().
CREATE OR REPLACE FUNCTION private.guard_listing_extras()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.location_lat := round(NEW.location_lat::numeric, 2)::double precision;
  NEW.location_lng := round(NEW.location_lng::numeric, 2)::double precision;
  IF NEW.location_district IS NOT NULL THEN
    NEW.location_district := upper(replace(NEW.location_district, ' ', ''));
  END IF;
  IF NEW.type <> 'part' THEN
    NEW.part_category := NULL;
  END IF;
  IF NOT NEW.postage_available THEN
    NEW.postage_price := NULL;
  END IF;
  IF current_setting('revmate.counter_update', true) IS DISTINCT FROM 'on' THEN
    NEW.buyer_id := CASE WHEN TG_OP = 'UPDATE' THEN OLD.buyer_id ELSE NULL END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_listing_extras() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_listing_extras ON public.listings;
CREATE TRIGGER guard_listing_extras
BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.guard_listing_extras();

-- ============================================================
-- SAVED SEARCHES + ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(filters) = 'object' AND pg_column_size(filters) <= 4000),
  alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saved_searches_user_idx ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS saved_searches_alerts_idx ON public.saved_searches(user_id) WHERE alerts;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_searches FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_searches TO authenticated;
GRANT ALL ON public.saved_searches TO service_role;
DROP POLICY IF EXISTS saved_searches_own_select ON public.saved_searches;
CREATE POLICY saved_searches_own_select ON public.saved_searches FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS saved_searches_own_insert ON public.saved_searches;
CREATE POLICY saved_searches_own_insert ON public.saved_searches FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())));
DROP POLICY IF EXISTS saved_searches_own_update ON public.saved_searches;
CREATE POLICY saved_searches_own_update ON public.saved_searches FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS saved_searches_own_delete ON public.saved_searches;
CREATE POLICY saved_searches_own_delete ON public.saved_searches FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION private.limit_saved_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.saved_searches WHERE user_id = NEW.user_id) >= 20 THEN
    RAISE EXCEPTION 'You can save up to 20 searches. Delete one to add another.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.limit_saved_searches() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS limit_saved_searches ON public.saved_searches;
CREATE TRIGGER limit_saved_searches
BEFORE INSERT ON public.saved_searches
FOR EACH ROW EXECUTE FUNCTION private.limit_saved_searches();

-- Which listings each search has already alerted about (so nobody is told twice).
CREATE TABLE IF NOT EXISTS public.saved_search_hits (
  search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (search_id, listing_id)
);
CREATE INDEX IF NOT EXISTS saved_search_hits_listing_idx ON public.saved_search_hits(listing_id);
ALTER TABLE public.saved_search_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saved_search_hits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.saved_search_hits TO service_role;

-- Same rules as the Buy & Sell filters in the app (src/lib/savedSearches.ts).
CREATE OR REPLACE FUNCTION private.listing_matches_search(l public.listings, f jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_make text;
  v_model text;
  v_year int;
  v_haystack text;
  v_word text;
  v_radius numeric;
  v_lat double precision;
  v_lng double precision;
  v_miles double precision;
BEGIN
  SELECT COALESCE(l.make, g.make, c.make), COALESCE(l.model, g.model, c.model), COALESCE(l.year, g.year)
    INTO v_make, v_model, v_year
  FROM (SELECT 1) one
  LEFT JOIN public.garage_cars g ON g.id = l.garage_car_id
  LEFT JOIN public.cars c ON c.id = l.car_id;

  IF COALESCE(f->>'type', '') <> '' AND l.type::text <> f->>'type' THEN RETURN false; END IF;
  IF COALESCE(f->>'make', '') <> '' AND lower(COALESCE(v_make, '')) <> lower(f->>'make') THEN RETURN false; END IF;
  IF COALESCE(f->>'model', '') <> '' AND lower(COALESCE(v_model, '')) <> lower(f->>'model') THEN RETURN false; END IF;
  IF COALESCE(f->>'yearFrom', '') ~ '^\d{4}$' AND COALESCE(v_year, 0) < (f->>'yearFrom')::int THEN RETURN false; END IF;
  IF COALESCE(f->>'yearTo', '') ~ '^\d{4}$' AND COALESCE(v_year, 9999) > (f->>'yearTo')::int THEN RETURN false; END IF;
  IF COALESCE(f->>'maxMileage', '') ~ '^\d{1,9}$'
     AND COALESCE(l.mileage, 2147483647) > (f->>'maxMileage')::bigint THEN RETURN false; END IF;
  IF COALESCE(f->>'fuel', '') <> '' AND COALESCE(l.fuel_type, '') <> f->>'fuel' THEN RETURN false; END IF;
  IF f->>'gearbox' = 'manual' AND COALESCE(l.transmission, '') <> 'manual' THEN RETURN false; END IF;
  IF f->>'gearbox' = 'automatic'
     AND COALESCE(l.transmission, '') NOT IN ('automatic', 'cvt', 'dct') THEN RETURN false; END IF;
  IF COALESCE(f->>'body', '') <> '' AND COALESCE(l.body_type, '') <> f->>'body' THEN RETURN false; END IF;
  IF COALESCE(f->>'seller', '') <> '' AND COALESCE(l.seller_type, 'private') <> f->>'seller' THEN RETURN false; END IF;
  IF f->>'ulezOnly' = 'true' AND l.ulez_compliant IS NOT TRUE THEN RETURN false; END IF;
  IF f->>'firstOwnerOnly' = 'true' AND NOT COALESCE(l.previous_owners <= 1, false) THEN RETURN false; END IF;
  IF COALESCE(f->>'partCategory', '') <> '' AND COALESCE(l.part_category, '') <> f->>'partCategory' THEN RETURN false; END IF;
  IF COALESCE(f->>'condition', '') <> '' AND COALESCE(l.item_condition, '') <> f->>'condition' THEN RETURN false; END IF;
  IF f->>'postageOnly' = 'true' AND NOT l.postage_available THEN RETURN false; END IF;
  IF COALESCE(f->>'minPrice', '') ~ '^\d{1,9}$' AND (l.price IS NULL OR l.price < (f->>'minPrice')::numeric) THEN RETURN false; END IF;
  IF COALESCE(f->>'maxPrice', '') ~ '^\d{1,9}$' AND (l.price IS NULL OR l.price >= (f->>'maxPrice')::numeric) THEN RETURN false; END IF;

  IF COALESCE(f->>'query', '') <> '' THEN
    v_haystack := lower(concat_ws(' ', l.title, l.description, l.headline, v_make, v_model, l.location_area));
    FOREACH v_word IN ARRAY regexp_split_to_array(lower(btrim(f->>'query')), '\s+') LOOP
      IF v_word <> '' AND position(v_word IN v_haystack) = 0 THEN RETURN false; END IF;
    END LOOP;
  END IF;

  -- Distance: only when the search has a centre and a radius. Listings
  -- without a location don't match a distance search (unless posted).
  IF COALESCE(f->>'radius', '') ~ '^\d{1,4}$'
     AND COALESCE(f->>'lat', '') ~ '^-?\d{1,3}(\.\d+)?$'
     AND COALESCE(f->>'lng', '') ~ '^-?\d{1,3}(\.\d+)?$' THEN
    v_radius := (f->>'radius')::numeric;
    v_lat := (f->>'lat')::double precision;
    v_lng := (f->>'lng')::double precision;
    IF l.location_lat IS NULL OR l.location_lng IS NULL THEN
      RETURN l.postage_available;
    END IF;
    v_miles := 3958.8 * 2 * asin(sqrt(
      power(sin(radians(l.location_lat - v_lat) / 2), 2)
      + cos(radians(v_lat)) * cos(radians(l.location_lat)) * power(sin(radians(l.location_lng - v_lng) / 2), 2)));
    IF v_miles > v_radius AND NOT l.postage_available THEN RETURN false; END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  -- A malformed saved search must never stop a listing being posted.
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION private.listing_matches_search(public.listings, jsonb) FROM PUBLIC, anon, authenticated;

-- New listing, or a price cut that brings it into someone's budget.
CREATE OR REPLACE FUNCTION private.notify_saved_searches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NOT (NEW.price IS NOT NULL AND OLD.price IS NOT NULL AND NEW.price < OLD.price) THEN
    RETURN NEW;
  END IF;
  WITH new_hits AS (
    INSERT INTO public.saved_search_hits(search_id, listing_id)
    SELECT s.id, NEW.id
    FROM public.saved_searches s
    WHERE s.alerts
      AND s.user_id <> NEW.user_id
      AND private.is_active_account(s.user_id)
      AND NOT private.users_are_blocked(s.user_id, NEW.user_id)
      AND private.listing_matches_search(NEW, s.filters)
    ON CONFLICT DO NOTHING
    RETURNING search_id
  ), per_user AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.name
    FROM new_hits h JOIN public.saved_searches s ON s.id = h.search_id
    ORDER BY s.user_id, s.created_at
  )
  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  SELECT p.user_id, NEW.user_id, 'search_alert',
    left(CASE WHEN TG_OP = 'UPDATE' THEN 'Price drop for "' ELSE 'New match for "' END
      || p.name || '": ' || NEW.title
      || COALESCE(' — £' || to_char(NEW.price, 'FM999,999,990'), ''), 500),
    '/marketplace/' || NEW.id::text
  FROM per_user p;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_saved_searches() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_saved_searches_insert ON public.listings;
CREATE TRIGGER notify_saved_searches_insert
AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.notify_saved_searches();
DROP TRIGGER IF EXISTS notify_saved_searches_price ON public.listings;
CREATE TRIGGER notify_saved_searches_price
AFTER UPDATE OF price ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.notify_saved_searches();

-- ============================================================
-- OFFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.listing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 10000000),
  counter_amount numeric CHECK (counter_amount IS NULL OR (counter_amount > 0 AND counter_amount <= 10000000)),
  final_amount numeric,
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'countered', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listing_offers_listing_idx ON public.listing_offers(listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_offers_buyer_idx ON public.listing_offers(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS listing_offers_seller_idx ON public.listing_offers(seller_id, created_at DESC);
ALTER TABLE public.listing_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_offers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.listing_offers TO authenticated;
GRANT ALL ON public.listing_offers TO service_role;
DROP POLICY IF EXISTS listing_offers_parties ON public.listing_offers;
CREATE POLICY listing_offers_parties ON public.listing_offers FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (buyer_id, seller_id));

CREATE OR REPLACE FUNCTION public.make_offer(target_listing uuid, offer_amount numeric, offer_message text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  v_listing public.listings;
  v_id uuid;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN
    RAISE EXCEPTION 'Sign in to make an offer.';
  END IF;
  IF NOT private.age_at_least(me, 18) THEN
    RAISE EXCEPTION 'Buying and selling on RevMate is for people aged 18 and over.';
  END IF;
  SELECT * INTO v_listing FROM public.listings WHERE id = target_listing;
  IF NOT FOUND OR v_listing.status <> 'active' THEN
    RAISE EXCEPTION 'This listing is no longer for sale.';
  END IF;
  IF v_listing.user_id = me THEN RAISE EXCEPTION 'You can''t make an offer on your own listing.'; END IF;
  IF NOT v_listing.open_to_offers THEN RAISE EXCEPTION 'This seller isn''t taking offers.'; END IF;
  IF private.users_are_blocked(me, v_listing.user_id) THEN
    RAISE EXCEPTION 'You can''t make an offer to this seller.';
  END IF;
  offer_amount := round(offer_amount);
  IF offer_amount IS NULL OR offer_amount <= 0 THEN RAISE EXCEPTION 'Enter an amount in pounds.'; END IF;
  IF v_listing.price IS NOT NULL AND offer_amount > v_listing.price THEN
    RAISE EXCEPTION 'Your offer is more than the asking price.';
  END IF;
  IF (SELECT count(*) FROM public.listing_offers
      WHERE listing_id = target_listing AND buyer_id = me AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You''ve made a lot of offers on this today. Message the seller instead.';
  END IF;
  -- A new offer replaces your previous open one.
  UPDATE public.listing_offers SET status = 'withdrawn', updated_at = now()
  WHERE listing_id = target_listing AND buyer_id = me AND status IN ('pending', 'countered');

  INSERT INTO public.listing_offers(listing_id, buyer_id, seller_id, amount, message)
  VALUES (target_listing, me, v_listing.user_id, offer_amount, left(btrim(COALESCE(offer_message, '')), 300))
  RETURNING id INTO v_id;

  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  VALUES (v_listing.user_id, me, 'offer',
    left('offered £' || to_char(offer_amount, 'FM999,999,990') || ' for ' || v_listing.title, 500),
    '/marketplace/' || target_listing::text);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.make_offer(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_offer(uuid, numeric, text) TO authenticated;

-- Seller: accept / decline / counter a pending offer.
-- Buyer: accept / decline a counter, or withdraw.
CREATE OR REPLACE FUNCTION public.respond_to_offer(target_offer uuid, offer_action text, new_counter numeric DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  v_offer public.listing_offers;
  v_title text;
  v_status text;
  v_notify uuid;
  v_text text;
BEGIN
  SELECT * INTO v_offer FROM public.listing_offers WHERE id = target_offer FOR UPDATE;
  IF NOT FOUND OR me IS NULL OR me NOT IN (v_offer.buyer_id, v_offer.seller_id) THEN
    RAISE EXCEPTION 'Offer not found.';
  END IF;
  SELECT title INTO v_title FROM public.listings WHERE id = v_offer.listing_id;

  IF me = v_offer.seller_id THEN
    IF v_offer.status <> 'pending' THEN RAISE EXCEPTION 'This offer has already been answered.'; END IF;
    IF offer_action = 'accept' THEN
      v_status := 'accepted';
      UPDATE public.listing_offers SET status = v_status, final_amount = amount, updated_at = now() WHERE id = target_offer;
      v_text := 'accepted your offer of £' || to_char(v_offer.amount, 'FM999,999,990') || ' for ' || v_title;
    ELSIF offer_action = 'decline' THEN
      v_status := 'declined';
      UPDATE public.listing_offers SET status = v_status, updated_at = now() WHERE id = target_offer;
      v_text := 'declined your offer for ' || v_title;
    ELSIF offer_action = 'counter' THEN
      new_counter := round(new_counter);
      IF new_counter IS NULL OR new_counter <= v_offer.amount THEN
        RAISE EXCEPTION 'A counter-offer should be more than their offer.';
      END IF;
      v_status := 'countered';
      UPDATE public.listing_offers SET status = v_status, counter_amount = new_counter, updated_at = now() WHERE id = target_offer;
      v_text := 'came back with £' || to_char(new_counter, 'FM999,999,990') || ' for ' || v_title;
    ELSE
      RAISE EXCEPTION 'Unknown action.';
    END IF;
    v_notify := v_offer.buyer_id;
  ELSE
    IF offer_action = 'withdraw' AND v_offer.status IN ('pending', 'countered') THEN
      v_status := 'withdrawn';
      UPDATE public.listing_offers SET status = v_status, updated_at = now() WHERE id = target_offer;
      RETURN v_status;
    END IF;
    IF v_offer.status <> 'countered' THEN RAISE EXCEPTION 'There''s nothing to answer on this offer.'; END IF;
    IF offer_action = 'accept' THEN
      v_status := 'accepted';
      UPDATE public.listing_offers SET status = v_status, final_amount = counter_amount, updated_at = now() WHERE id = target_offer;
      v_text := 'accepted your price of £' || to_char(v_offer.counter_amount, 'FM999,999,990') || ' for ' || v_title;
    ELSIF offer_action = 'decline' THEN
      v_status := 'declined';
      UPDATE public.listing_offers SET status = v_status, updated_at = now() WHERE id = target_offer;
      v_text := 'turned down your counter-offer for ' || v_title;
    ELSE
      RAISE EXCEPTION 'Unknown action.';
    END IF;
    v_notify := v_offer.seller_id;
  END IF;

  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  VALUES (v_notify, me, 'offer_update', left(v_text, 500), '/marketplace/' || v_offer.listing_id::text);
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_offer(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_offer(uuid, text, numeric) TO authenticated;

-- ============================================================
-- SELLER REVIEWS (only the buyer of a "Sold through RevMate" listing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seller_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE REFERENCES public.listings(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seller_reviews_seller_idx ON public.seller_reviews(seller_id, created_at DESC);
ALTER TABLE public.seller_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seller_reviews TO anon, authenticated;
GRANT DELETE ON public.seller_reviews TO authenticated;
GRANT ALL ON public.seller_reviews TO service_role;
DROP POLICY IF EXISTS seller_reviews_public ON public.seller_reviews;
CREATE POLICY seller_reviews_public ON public.seller_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS seller_reviews_admin_delete ON public.seller_reviews;
CREATE POLICY seller_reviews_admin_delete ON public.seller_reviews FOR DELETE TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())) OR reviewer_id = (SELECT auth.uid()));

-- People who've messaged the seller — who the seller can pick as the buyer.
CREATE OR REPLACE FUNCTION public.listing_buyer_candidates(target_listing uuid)
RETURNS TABLE (user_id uuid, username text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.user_id, p.username, p.avatar_url
  FROM public.listings l
  JOIN public.conversations c ON l.user_id IN (c.user_a, c.user_b)
  JOIN public.profiles p ON p.user_id = CASE WHEN c.user_a = l.user_id THEN c.user_b ELSE c.user_a END
  WHERE l.id = target_listing
    AND l.user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.conversation_id = c.id AND m.sender_id = p.user_id
        AND m.created_at > l.created_at - interval '1 day'
    )
  ORDER BY (SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id) DESC
  LIMIT 30;
$$;
REVOKE ALL ON FUNCTION public.listing_buyer_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listing_buyer_candidates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_listing_buyer(target_listing uuid, target_buyer uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  v_listing public.listings;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = target_listing;
  IF NOT FOUND OR v_listing.user_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Listing not found.'; END IF;
  IF v_listing.status <> 'sold_revmate' THEN
    RAISE EXCEPTION 'Mark it as sold through RevMate first.';
  END IF;
  IF v_listing.buyer_id IS NOT NULL THEN RAISE EXCEPTION 'You''ve already chosen the buyer.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.listing_buyer_candidates(target_listing) b WHERE b.user_id = target_buyer) THEN
    RAISE EXCEPTION 'Pick someone who messaged you about it.';
  END IF;
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.listings SET buyer_id = target_buyer WHERE id = target_listing;
  PERFORM set_config('revmate.counter_update', 'off', true);
  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  VALUES (target_buyer, me, 'review_request',
    left('How was buying ' || v_listing.title || '? Leave a quick review.', 500),
    '/review/' || target_listing::text);
END;
$$;
REVOKE ALL ON FUNCTION public.set_listing_buyer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_listing_buyer(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_seller_review(target_listing uuid, review_rating int, review_body text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  v_listing public.listings;
BEGIN
  SELECT * INTO v_listing FROM public.listings WHERE id = target_listing;
  IF NOT FOUND OR me IS NULL OR v_listing.buyer_id IS DISTINCT FROM me OR v_listing.status <> 'sold_revmate' THEN
    RAISE EXCEPTION 'Only the buyer can review this sale.';
  END IF;
  IF review_rating IS NULL OR review_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Pick 1 to 5 stars.'; END IF;
  INSERT INTO public.seller_reviews(listing_id, seller_id, reviewer_id, rating, body)
  VALUES (target_listing, v_listing.user_id, me, review_rating, left(btrim(COALESCE(review_body, '')), 1000))
  ON CONFLICT (listing_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
END;
$$;
REVOKE ALL ON FUNCTION public.leave_seller_review(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_seller_review(uuid, int, text) TO authenticated;

-- ============================================================
-- SELLER TRUST STATS (public; no message content leaves the database)
-- ============================================================
CREATE OR REPLACE FUNCTION public.seller_stats(target_seller uuid)
RETURNS TABLE (
  member_since timestamptz,
  active_listings int,
  sold_listings int,
  reviews_count int,
  rating_avg numeric,
  reply_minutes int,
  replies_sampled int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH firsts AS (
    -- In each conversation from the last 90 days: when the other person first
    -- wrote, and when the seller first replied after that.
    SELECT c.id,
      (SELECT min(m.created_at) FROM public.messages m
        WHERE m.conversation_id = c.id AND m.sender_id <> target_seller
          AND m.created_at > now() - interval '90 days') AS asked
    FROM public.conversations c
    WHERE target_seller IN (c.user_a, c.user_b)
  ), replies AS (
    SELECT f.asked,
      (SELECT min(m.created_at) FROM public.messages m
        WHERE m.conversation_id = f.id AND m.sender_id = target_seller AND m.created_at > f.asked) AS replied
    FROM firsts f WHERE f.asked IS NOT NULL
  )
  SELECT
    p.created_at,
    (SELECT count(*)::int FROM public.listings l WHERE l.user_id = target_seller AND l.status = 'active'),
    (SELECT count(*)::int FROM public.listings l WHERE l.user_id = target_seller AND l.status IN ('sold_revmate', 'sold_elsewhere')),
    (SELECT count(*)::int FROM public.seller_reviews r WHERE r.seller_id = target_seller),
    (SELECT round(avg(r.rating), 1) FROM public.seller_reviews r WHERE r.seller_id = target_seller),
    (SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (r.replied - r.asked)) / 60))::int
      FROM replies r WHERE r.replied IS NOT NULL),
    (SELECT count(*)::int FROM replies r WHERE r.replied IS NOT NULL)
  FROM public.profiles p
  WHERE p.user_id = target_seller;
$$;
REVOKE ALL ON FUNCTION public.seller_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_stats(uuid) TO anon, authenticated;

COMMIT;
