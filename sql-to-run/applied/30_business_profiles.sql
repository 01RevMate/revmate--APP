-- Step 30: Google-style business profiles (photos, review photos, owner replies, hours, more sectors).
-- Copy of drizzle/migrations/0070_business_profiles.sql. Safe to re-run.

-- Google-style business profiles.
--
-- * Many more car-business sectors (dealerships of every kind, specialists,
--   glass, wraps, wheel refurb, breakers, hire, storage, driving schools…).
-- * business_photos: a photo gallery per business. Admins and the business
--   owner add "business" photos; members add "customer" photos to their own
--   review. Photos must be uploaded to RevMate's own storage.
-- * Opening hours, address, email and a list of services on each business.
-- * Owners (businesses.owner_user_id, set by an admin) can keep their own
--   profile up to date and reply to reviews, but can't change their name,
--   verified badge, status, owner or Business Pro dates.
--
-- Safe to re-run.

-- ---------- Sectors ----------
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.businesses'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%category%'
  LOOP
    EXECUTE format('ALTER TABLE public.businesses DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.businesses ADD CONSTRAINT businesses_category_check CHECK (category IN (
  -- Dealerships
  'dealer', 'franchise_dealer', 'prestige_dealer', 'van_dealer', 'motorbike_dealer', 'car_buying',
  -- Servicing & repairs
  'garage', 'mobile_mechanic', 'mot_centre', 'specialist', 'auto_electrician', 'diagnostics',
  'air_con', 'exhaust_centre', 'clutch_gearbox',
  -- Body & glass
  'bodywork', 'smart_repair', 'windscreen', 'wraps',
  -- Care & detailing
  'detailing', 'car_wash',
  -- Wheels & tyres
  'tyres', 'wheel_refurb', 'alignment',
  -- Performance & style
  'tuning', 'car_audio', 'restoration', 'motorsport',
  -- Parts
  'parts', 'breakers', 'accessories',
  -- Electric
  'ev_charger_installer', 'ev_specialist',
  -- Services
  'recovery', 'insurance', 'finance', 'car_hire', 'driving_school', 'storage', 'transport',
  'number_plates', 'inspection',
  'other'
));

-- ---------- Profile details ----------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS email text,
  -- {"mon": {"open": "08:00", "close": "17:30"}, "sun": null, ...}; null = not given.
  ADD COLUMN IF NOT EXISTS opening_hours jsonb,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'businesses_profile_fields_check') THEN
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_profile_fields_check CHECK (
      (address IS NULL OR char_length(address) <= 200)
      AND (email IS NULL OR (char_length(email) <= 120 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
      AND (opening_hours IS NULL OR jsonb_typeof(opening_hours) = 'object')
      AND cardinality(services) <= 30
    );
  END IF;
END $$;

-- Owners can edit their own business, but not these.
CREATE OR REPLACE FUNCTION private.guard_business_owner_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Admins, and server-side jobs with no signed-in user (billing), are free.
  IF (SELECT auth.uid()) IS NULL OR private.is_revmate_admin((SELECT auth.uid())) THEN
    RETURN NEW;
  END IF;
  NEW.name := OLD.name;
  NEW.verified := OLD.verified;
  NEW.status := OLD.status;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.promoted_until := OLD.promoted_until;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_business_owner_edit ON public.businesses;
CREATE TRIGGER guard_business_owner_edit BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION private.guard_business_owner_edit();
REVOKE ALL ON FUNCTION private.guard_business_owner_edit() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS businesses_owner_update ON public.businesses;
CREATE POLICY businesses_owner_update ON public.businesses FOR UPDATE TO authenticated
  USING (owner_user_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())))
  WITH CHECK (owner_user_id = (SELECT auth.uid()));

-- Owners can see their own business even while it's suspended.
DROP POLICY IF EXISTS businesses_read ON public.businesses;
CREATE POLICY businesses_read ON public.businesses FOR SELECT
  USING (
    status = 'active'
    OR owner_user_id = (SELECT auth.uid())
    OR private.is_revmate_admin((SELECT auth.uid()))
  );

-- ---------- Photos ----------
CREATE TABLE IF NOT EXISTS public.business_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Set for a customer's photo, which always belongs to their review.
  review_id uuid REFERENCES public.business_reviews(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'customer' CHECK (source IN ('business', 'customer')),
  url text NOT NULL CHECK (url ~ '^https://' AND char_length(url) <= 600),
  caption text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 140),
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_photos_business_idx
  ON public.business_photos (business_id, source, position, created_at);
CREATE INDEX IF NOT EXISTS business_photos_review_idx ON public.business_photos (review_id);

CREATE OR REPLACE FUNCTION private.stamp_business_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  is_admin boolean := private.is_revmate_admin(me);
  is_owner boolean;
  n int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only the caption and order can change.
    NEW.business_id := OLD.business_id; NEW.review_id := OLD.review_id;
    NEW.uploaded_by := OLD.uploaded_by; NEW.source := OLD.source;
    NEW.url := OLD.url; NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  IF me IS NULL THEN RETURN NEW; END IF; -- server-side import
  NEW.uploaded_by := me;
  NEW.created_at := now();
  SELECT b.owner_user_id = me INTO is_owner FROM public.businesses b WHERE b.id = NEW.business_id;

  -- Photos must live in RevMate's own storage (admins may also link others).
  IF NOT is_admin AND NEW.url !~ '/storage/v1/object/public/(user-media|post-images)/' THEN
    RAISE EXCEPTION 'Upload the photo to RevMate first';
  END IF;

  IF NEW.review_id IS NULL THEN
    IF NOT (is_admin OR coalesce(is_owner, false)) THEN
      RAISE EXCEPTION 'Only the business can add photos here. Add yours to a review.';
    END IF;
    NEW.source := 'business';
    SELECT count(*) INTO n FROM public.business_photos
      WHERE business_id = NEW.business_id AND source = 'business';
    IF n >= 40 THEN RAISE EXCEPTION 'A business can have up to 40 photos'; END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.business_reviews r
      WHERE r.id = NEW.review_id AND r.user_id = me AND r.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'You can only add photos to your own review';
    END IF;
    NEW.source := 'customer';
    SELECT count(*) INTO n FROM public.business_photos WHERE review_id = NEW.review_id;
    IF n >= 5 THEN RAISE EXCEPTION 'Up to 5 photos per review'; END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS stamp_business_photo ON public.business_photos;
CREATE TRIGGER stamp_business_photo BEFORE INSERT OR UPDATE ON public.business_photos
  FOR EACH ROW EXECUTE FUNCTION private.stamp_business_photo();
REVOKE ALL ON FUNCTION private.stamp_business_photo() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.business_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_photos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_photos TO authenticated;
GRANT ALL ON public.business_photos TO service_role;

DROP POLICY IF EXISTS business_photos_read ON public.business_photos;
CREATE POLICY business_photos_read ON public.business_photos FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.status = 'active')
  OR private.is_revmate_admin((SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid()))
);
DROP POLICY IF EXISTS business_photos_insert ON public.business_photos;
CREATE POLICY business_photos_insert ON public.business_photos FOR INSERT TO authenticated
  WITH CHECK (private.is_active_account((SELECT auth.uid())));
DROP POLICY IF EXISTS business_photos_update ON public.business_photos;
CREATE POLICY business_photos_update ON public.business_photos FOR UPDATE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR private.is_revmate_admin((SELECT auth.uid()))
    OR (source = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid())))
  );
-- Owners can remove their business photos, not customers' (they can report those).
DROP POLICY IF EXISTS business_photos_delete ON public.business_photos;
CREATE POLICY business_photos_delete ON public.business_photos FOR DELETE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR private.is_revmate_admin((SELECT auth.uid()))
    OR (source = 'business' AND EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid())))
  );

-- ---------- Owner replies to reviews ----------
ALTER TABLE public.business_reviews
  ADD COLUMN IF NOT EXISTS owner_reply text CHECK (owner_reply IS NULL OR char_length(owner_reply) <= 1000),
  ADD COLUMN IF NOT EXISTS owner_replied_at timestamptz;

-- Reviewers can't write (or wipe) the owner's reply; only reply_to_review can.
CREATE OR REPLACE FUNCTION private.guard_review_reply() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('revmate.owner_reply', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.owner_reply := NULL; NEW.owner_replied_at := NULL;
    ELSE
      NEW.owner_reply := OLD.owner_reply; NEW.owner_replied_at := OLD.owner_replied_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_review_reply ON public.business_reviews;
CREATE TRIGGER guard_review_reply BEFORE INSERT OR UPDATE ON public.business_reviews
  FOR EACH ROW EXECUTE FUNCTION private.guard_review_reply();
REVOKE ALL ON FUNCTION private.guard_review_reply() FROM PUBLIC, anon, authenticated;

-- The business owner (or an admin) replies to a review; empty text removes it.
CREATE OR REPLACE FUNCTION public.reply_to_review(p_review uuid, p_reply text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  reply text := nullif(btrim(coalesce(p_reply, '')), '');
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN
    RAISE EXCEPTION 'Sign in to reply';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.business_reviews r JOIN public.businesses b ON b.id = r.business_id
    WHERE r.id = p_review AND (b.owner_user_id = me OR private.is_revmate_admin(me))
  ) THEN
    RAISE EXCEPTION 'Only the business can reply to its reviews';
  END IF;
  IF char_length(coalesce(reply, '')) > 1000 THEN RAISE EXCEPTION 'Keep the reply under 1,000 characters'; END IF;
  PERFORM set_config('revmate.owner_reply', 'on', true);
  UPDATE public.business_reviews
    SET owner_reply = reply, owner_replied_at = CASE WHEN reply IS NULL THEN NULL ELSE now() END
    WHERE id = p_review;
  PERFORM set_config('revmate.owner_reply', 'off', true);
END; $$;
REVOKE ALL ON FUNCTION public.reply_to_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reply_to_review(uuid, text) TO authenticated;
