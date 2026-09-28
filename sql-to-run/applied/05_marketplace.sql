-- STEP 5 — Marketplace pack (watchlist, price drops & alerts, view counts,
-- Featured listings, sponsored partners, seller area)
-- Copy of drizzle/migrations/0035_marketplace.sql
-- Run the whole file once. Needs steps 1–4 (already applied).

-- Marketplace pack: watchlist (saved listings), price-drop tracking with
-- alerts to watchers, honest view counts, Featured listings, sponsored
-- partner slots and an optional seller area. Run after 0033_engagement.sql.
-- Everything is additive — no existing listings are deleted or changed.

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
    'price_drop'
  )
);

-- ============================================================
-- LISTING COLUMNS
-- ============================================================
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS previous_price numeric,
  ADD COLUMN IF NOT EXISTS price_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS views_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS location_area text
    CHECK (location_area IS NULL OR char_length(btrim(location_area)) BETWEEN 2 AND 60);
CREATE INDEX IF NOT EXISTS listings_active_created_idx
  ON public.listings(created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS listings_featured_idx
  ON public.listings(featured_until) WHERE featured_until IS NOT NULL;

-- Sellers edit their own listings, but counters, the previous price and the
-- Featured flag are only moved by the database (Featured by admins).
CREATE FUNCTION private.guard_listing_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.views_count := OLD.views_count;
  NEW.saves_count := OLD.saves_count;
  NEW.previous_price := OLD.previous_price;
  NEW.price_changed_at := OLD.price_changed_at;
  IF NEW.featured_until IS DISTINCT FROM OLD.featured_until
    AND NOT private.is_revmate_admin((SELECT auth.uid())) THEN
    NEW.featured_until := OLD.featured_until;
  END IF;
  -- A price cut is remembered so buyers see "was £X" and watchers get told.
  IF NEW.price IS NOT NULL AND OLD.price IS NOT NULL AND NEW.price < OLD.price THEN
    NEW.previous_price := OLD.price;
    NEW.price_changed_at := now();
  ELSIF NEW.price IS DISTINCT FROM OLD.price THEN
    -- Price went up (or was removed): drop the old "was" price.
    NEW.previous_price := NULL;
    NEW.price_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_listing_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_listing_update
BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.guard_listing_update();

-- Admins can feature (or un-feature) anyone's listing.
CREATE POLICY "Admins update any listing"
ON public.listings FOR UPDATE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())))
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

-- New listings can't arrive pre-featured or with fake counts.
CREATE FUNCTION private.guard_listing_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.views_count := 0;
  NEW.saves_count := 0;
  NEW.previous_price := NULL;
  NEW.price_changed_at := NULL;
  IF NOT private.is_revmate_admin((SELECT auth.uid())) THEN
    NEW.featured_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_listing_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_listing_insert
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.guard_listing_insert();

-- ============================================================
-- WATCHLIST
-- ============================================================
CREATE TABLE public.saved_listings (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX saved_listings_listing_idx ON public.saved_listings(listing_id);
GRANT SELECT, INSERT, DELETE ON public.saved_listings TO authenticated;
GRANT ALL ON public.saved_listings TO service_role;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own watchlist"
ON public.saved_listings FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users watch listings as themselves"
ON public.saved_listings FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id AND private.is_active_account((SELECT auth.uid())));
CREATE POLICY "Users unwatch their own listings"
ON public.saved_listings FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE FUNCTION private.handle_saved_listing_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.listings SET saves_count = saves_count + 1 WHERE id = NEW.listing_id;
  ELSE
    UPDATE public.listings SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.listing_id;
  END IF;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.handle_saved_listing_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_saved_listing_change
AFTER INSERT OR DELETE ON public.saved_listings
FOR EACH ROW EXECUTE FUNCTION private.handle_saved_listing_change();

-- Tell everyone watching a listing when its price comes down.
CREATE FUNCTION private.notify_price_drop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'active' OR NEW.price IS NULL OR OLD.price IS NULL OR NEW.price >= OLD.price THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  SELECT s.user_id, NEW.user_id, 'price_drop',
    left(NEW.title || ' dropped from £' || to_char(OLD.price, 'FM999,999,990')
      || ' to £' || to_char(NEW.price, 'FM999,999,990'), 500),
    '/marketplace/' || NEW.id::text
  FROM public.saved_listings s
  WHERE s.listing_id = NEW.id
    AND s.user_id <> NEW.user_id
    AND private.is_active_account(s.user_id)
    AND NOT private.users_are_blocked(s.user_id, NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_price_drop() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_price_drop
AFTER UPDATE OF price ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.notify_price_drop();

-- ============================================================
-- VIEWS — one per signed-in person per listing per day, sellers excluded
-- ============================================================
CREATE TABLE public.listing_views (
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  viewed_on date NOT NULL DEFAULT private.uk_today(),
  PRIMARY KEY (listing_id, viewer_id, viewed_on)
);
GRANT ALL ON public.listing_views TO service_role;
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.record_listing_view(target_listing uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.listings WHERE id = target_listing AND user_id = me) THEN
    RETURN; -- sellers looking at their own advert don't count
  END IF;
  INSERT INTO public.listing_views(listing_id, viewer_id) VALUES (target_listing, me)
  ON CONFLICT DO NOTHING;
  IF FOUND THEN
    PERFORM set_config('revmate.counter_update', 'on', true);
    UPDATE public.listings SET views_count = views_count + 1 WHERE id = target_listing;
    PERFORM set_config('revmate.counter_update', 'off', true);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_listing_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_listing_view(uuid) TO authenticated;

-- ============================================================
-- SPONSORED PARTNERS (parts suppliers, HPI checks, insurance…)
-- ============================================================
CREATE TABLE public.marketplace_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  tagline text NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 140),
  image_url text CHECK (image_url IS NULL OR image_url LIKE 'https://%'),
  url text NOT NULL CHECK (url LIKE 'https://%'),
  cta text NOT NULL DEFAULT 'Shop now' CHECK (char_length(btrim(cta)) BETWEEN 2 AND 30),
  placement text NOT NULL DEFAULT 'grid' CHECK (placement IN ('grid', 'banner')),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  clicks_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_partners TO authenticated;
GRANT ALL ON public.marketplace_partners TO service_role;
ALTER TABLE public.marketplace_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active partners are public"
ON public.marketplace_partners FOR SELECT TO anon, authenticated
USING (active OR private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins add partners"
ON public.marketplace_partners FOR INSERT TO authenticated
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins edit partners"
ON public.marketplace_partners FOR UPDATE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())))
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins remove partners"
ON public.marketplace_partners FOR DELETE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())));

-- Counts clicks so you can show partners what RevMate sends them.
CREATE FUNCTION public.record_partner_click(target_partner uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.marketplace_partners SET clicks_count = clicks_count + 1
  WHERE id = target_partner AND active;
$$;
REVOKE ALL ON FUNCTION public.record_partner_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_partner_click(uuid) TO anon, authenticated;

COMMIT;
