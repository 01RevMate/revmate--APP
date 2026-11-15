-- Business foundation (Phase 1): approval workflow, tiers, revisions, follows, photo safeguards.
-- Additive and reversible (see 0080_business_foundation_down.sql). Nothing is dropped.
-- Existing live businesses are grandfathered as approved ("legacy approvals") and stay online.
--
-- Visibility rule enforced in the database: a business is public only when
--   approval_status = 'approved' AND suspended_at IS NULL.
-- The legacy `status` column ('active' | 'suspended') is now derived from those two fields by a
-- trigger, so every existing policy and function that checks status = 'active' (directory,
-- reviews, photos, ads_for_me, listing joins) automatically excludes unapproved businesses.

-- ---------------------------------------------------------------------------
-- 0. Safety snapshot of the businesses table (admin/service role only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_foundation_backup_20261115 AS TABLE public.businesses;
ALTER TABLE public.business_foundation_backup_20261115 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_foundation_backup_20261115 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_foundation_backup_20261115 TO service_role;

-- ---------------------------------------------------------------------------
-- 1. New columns on businesses
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'listing',
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legacy_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS legacy_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS appeal_message text,
  ADD COLUMN IF NOT EXISTS appeal_used boolean NOT NULL DEFAULT false;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_approval_status_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_approval_status_check
  CHECK (approval_status IN ('draft', 'pending', 'needs_changes', 'approved', 'rejected', 'appealed'));
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_tier_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_tier_check CHECK (tier IN ('listing', 'full'));
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_review_text_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_review_text_check CHECK (
  (review_reason IS NULL OR char_length(review_reason) <= 1000)
  AND (appeal_message IS NULL OR char_length(appeal_message) <= 1000)
  AND (suspended_reason IS NULL OR char_length(suspended_reason) <= 1000));

-- ---------------------------------------------------------------------------
-- 2. Grandfather every existing business (they stay online as legacy approvals)
--    Runs before the new triggers exist.
-- ---------------------------------------------------------------------------
UPDATE public.businesses
SET approval_status = 'approved',
    approved_at = coalesce(created_at, now()),
    legacy_approved = true,
    legacy_approved_at = now(),
    suspended_at = CASE WHEN status = 'suspended' THEN now() END
WHERE approval_status = 'draft' AND legacy_approved = false;

-- ---------------------------------------------------------------------------
-- 3. Supporting tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_features (
  name text PRIMARY KEY,
  version int NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schema_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schema_features_read ON public.schema_features;
CREATE POLICY schema_features_read ON public.schema_features FOR SELECT USING (true);
GRANT SELECT ON public.schema_features TO anon, authenticated;
GRANT ALL ON public.schema_features TO service_role;

-- Append-only record of every approval-related change.
CREATE TABLE IF NOT EXISTS public.business_approval_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'status',
  from_status text,
  to_status text,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS business_approval_log_business_idx ON public.business_approval_log (business_id, created_at DESC);
ALTER TABLE public.business_approval_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_approval_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_approval_log TO authenticated;
GRANT ALL ON public.business_approval_log TO service_role;
DROP POLICY IF EXISTS business_approval_log_read ON public.business_approval_log;
CREATE POLICY business_approval_log_read ON public.business_approval_log FOR SELECT TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid())));

-- Proposed edits to an approved business; the live row keeps the last approved version.
CREATE TABLE IF NOT EXISTS public.business_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  proposed jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  submitted_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS business_revisions_one_open ON public.business_revisions (business_id) WHERE status = 'pending';
ALTER TABLE public.business_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_revisions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_revisions TO authenticated;
GRANT ALL ON public.business_revisions TO service_role;
DROP POLICY IF EXISTS business_revisions_read ON public.business_revisions;
CREATE POLICY business_revisions_read ON public.business_revisions FOR SELECT TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid())));

-- Requests to upgrade a listing business to a full business.
CREATE TABLE IF NOT EXISTS public.business_tier_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS business_tier_requests_one_open ON public.business_tier_requests (business_id) WHERE status = 'pending';
ALTER TABLE public.business_tier_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_tier_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_tier_requests TO authenticated;
GRANT ALL ON public.business_tier_requests TO service_role;
DROP POLICY IF EXISTS business_tier_requests_read ON public.business_tier_requests;
CREATE POLICY business_tier_requests_read ON public.business_tier_requests FOR SELECT TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid())));

-- Personal accounts follow a business. Followers are never listed; only a count is public.
CREATE TABLE IF NOT EXISTS public.business_follows (
  follower_user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_user_id, business_id)
);
CREATE INDEX IF NOT EXISTS business_follows_business_idx ON public.business_follows (business_id);
ALTER TABLE public.business_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_follows FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.business_follows TO authenticated;
GRANT ALL ON public.business_follows TO service_role;
DROP POLICY IF EXISTS business_follows_read ON public.business_follows;
CREATE POLICY business_follows_read ON public.business_follows FOR SELECT TO authenticated
  USING (follower_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS business_follows_insert ON public.business_follows;
CREATE POLICY business_follows_insert ON public.business_follows FOR INSERT TO authenticated
  WITH CHECK (
    follower_user_id = (SELECT auth.uid())
    AND private.is_active_account((SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.businesses b
      WHERE b.id = business_id AND b.status = 'active' AND b.owner_user_id IS DISTINCT FROM (SELECT auth.uid())));
DROP POLICY IF EXISTS business_follows_delete ON public.business_follows;
CREATE POLICY business_follows_delete ON public.business_follows FOR DELETE TO authenticated
  USING (follower_user_id = (SELECT auth.uid()));

-- Reports against a single business photo.
CREATE TABLE IF NOT EXISTS public.business_photo_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id uuid NOT NULL REFERENCES public.business_photos(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('inappropriate', 'not_this_business', 'misleading', 'copyright', 'other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (photo_id, reporter_id)
);
ALTER TABLE public.business_photo_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_photo_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.business_photo_reports TO authenticated;
GRANT ALL ON public.business_photo_reports TO service_role;
DROP POLICY IF EXISTS business_photo_reports_read ON public.business_photo_reports;
CREATE POLICY business_photo_reports_read ON public.business_photo_reports FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS business_photo_reports_insert ON public.business_photo_reports;
CREATE POLICY business_photo_reports_insert ON public.business_photo_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())) AND status = 'open');

-- Photos: new owner uploads wait for approval; everything already there stays approved.
ALTER TABLE public.business_photos
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.business_photos DROP CONSTRAINT IF EXISTS business_photos_review_status_check;
ALTER TABLE public.business_photos ADD CONSTRAINT business_photos_review_status_check
  CHECK (review_status IN ('pending', 'approved', 'rejected'));

-- ---------------------------------------------------------------------------
-- 4. Helper: write to the approval log
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.log_business_event(p_business uuid, p_kind text, p_from text, p_to text, p_reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.business_approval_log (business_id, actor_id, kind, from_status, to_status, reason)
  VALUES (p_business, (SELECT auth.uid()), p_kind, p_from, p_to, p_reason)
$$;
REVOKE ALL ON FUNCTION private.log_business_event(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

INSERT INTO public.business_approval_log (business_id, actor_id, kind, from_status, to_status, reason)
SELECT b.id, NULL, 'grandfathered', NULL, 'approved', 'Live before approvals existed (legacy approval)'
FROM public.businesses b
WHERE b.legacy_approved
  AND NOT EXISTS (SELECT 1 FROM public.business_approval_log l WHERE l.business_id = b.id AND l.kind = 'grandfathered');

-- ---------------------------------------------------------------------------
-- 5. Triggers on businesses
-- ---------------------------------------------------------------------------
-- 5a. Inserts: non-admins always start as a draft listing, capped at 3 businesses each.
CREATE OR REPLACE FUNCTION private.guard_business_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR private.is_revmate_admin(me) THEN
    -- Admin / server-side creation keeps the old meaning of status = 'active': live and approved.
    IF NEW.approval_status = 'draft' AND NEW.status = 'active' THEN
      NEW.approval_status := 'approved';
      NEW.approved_at := now();
      NEW.approved_by := me;
    END IF;
    RETURN NEW;
  END IF;
  NEW.approval_status := 'draft';
  NEW.tier := 'listing';
  NEW.suspended_at := NULL; NEW.suspended_reason := NULL;
  NEW.review_reason := NULL; NEW.submitted_at := NULL;
  NEW.approved_at := NULL; NEW.approved_by := NULL;
  NEW.legacy_approved := false; NEW.legacy_approved_at := NULL;
  NEW.appeal_message := NULL; NEW.appeal_used := false;
  IF (SELECT count(*) FROM public.businesses b
        WHERE b.owner_user_id = NEW.owner_user_id AND b.approval_status <> 'rejected') >= 3 THEN
    RAISE EXCEPTION 'You can have up to 3 businesses';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_business_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_business_insert ON public.businesses;
CREATE TRIGGER guard_business_insert BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION private.guard_business_insert();

-- 5b. Owners can't touch approval fields; reviewed fields are locked once a business is under review or live.
CREATE OR REPLACE FUNCTION private.guard_business_owner_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR private.is_revmate_admin((SELECT auth.uid()))
     OR current_setting('revmate.business_rpc', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.id := OLD.id;
  NEW.verified := OLD.verified;
  NEW.status := OLD.status;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.promoted_until := OLD.promoted_until;
  NEW.created_at := OLD.created_at;
  NEW.approval_status := OLD.approval_status;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.tier := OLD.tier;
  NEW.review_reason := OLD.review_reason;
  NEW.submitted_at := OLD.submitted_at;
  NEW.approved_at := OLD.approved_at;
  NEW.approved_by := OLD.approved_by;
  NEW.legacy_approved := OLD.legacy_approved;
  NEW.legacy_approved_at := OLD.legacy_approved_at;
  NEW.appeal_message := OLD.appeal_message;
  NEW.appeal_used := OLD.appeal_used;
  -- Name and public details of a business under review or live change only through a reviewed revision.
  IF OLD.approval_status NOT IN ('draft', 'needs_changes') AND (
       NEW.name IS DISTINCT FROM OLD.name OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.description IS DISTINCT FROM OLD.description OR NEW.logo_url IS DISTINCT FROM OLD.logo_url
       OR NEW.website IS DISTINCT FROM OLD.website OR NEW.address IS DISTINCT FROM OLD.address
       OR NEW.phone IS DISTINCT FROM OLD.phone OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.services IS DISTINCT FROM OLD.services) THEN
    RAISE EXCEPTION 'Changes to a business under review or live are checked first. Submit them for approval instead.';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_business_owner_edit() FROM PUBLIC, anon, authenticated;

-- 5c. Only the permitted approval transitions, and only through the approved RPCs (or service role).
CREATE OR REPLACE FUNCTION private.enforce_business_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status THEN RETURN NEW; END IF;
  IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF; -- service role / migrations
  IF current_setting('revmate.business_rpc', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Approval status changes only through the review functions';
  END IF;
  IF NOT ((OLD.approval_status, NEW.approval_status) IN (
      ('draft', 'pending'), ('needs_changes', 'pending'),
      ('pending', 'approved'), ('pending', 'needs_changes'), ('pending', 'rejected'),
      ('rejected', 'appealed'), ('appealed', 'approved'), ('appealed', 'rejected'),
      ('rejected', 'needs_changes'), ('appealed', 'needs_changes'))) THEN
    RAISE EXCEPTION 'A business cannot move from % to %', OLD.approval_status, NEW.approval_status;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.enforce_business_transition() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_business_transition ON public.businesses;
CREATE TRIGGER enforce_business_transition BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION private.enforce_business_transition();

-- 5d. Keep the legacy status column derived from approval and suspension (runs after the guards).
CREATE OR REPLACE FUNCTION private.sync_business_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
BEGIN
  -- The older admin screen toggles status directly: honour that as an admin suspend / activate.
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.approval_status IS NOT DISTINCT FROM OLD.approval_status
     AND NEW.suspended_at IS NOT DISTINCT FROM OLD.suspended_at
     AND private.is_revmate_admin(me) THEN
    IF NEW.status = 'suspended' THEN
      NEW.suspended_at := now();
    ELSE
      NEW.suspended_at := NULL;
      IF NEW.approval_status <> 'approved' THEN
        NEW.approval_status := 'approved';
        NEW.approved_at := now();
        NEW.approved_by := me;
        PERFORM private.log_business_event(NEW.id, 'legacy_toggle', OLD.approval_status, 'approved', 'Activated from the admin businesses screen');
      END IF;
    END IF;
  END IF;
  NEW.status := CASE WHEN NEW.approval_status = 'approved' AND NEW.suspended_at IS NULL THEN 'active' ELSE 'suspended' END;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.sync_business_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sync_business_status ON public.businesses;
CREATE TRIGGER sync_business_status BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION private.sync_business_status();

-- ---------------------------------------------------------------------------
-- 6. Policies: drafts only on insert; visibility follows the derived status
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS businesses_owner_insert ON public.businesses;
CREATE POLICY businesses_owner_insert ON public.businesses FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid()))
    AND verified = false AND promoted_until IS NULL AND approval_status = 'draft' AND tier = 'listing');

-- Reviews of a business are only readable where the business itself is visible to you.
DROP POLICY IF EXISTS reviews_read ON public.business_reviews;
CREATE POLICY reviews_read ON public.business_reviews FOR SELECT USING (
  (private.is_active_account(user_id) OR user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())))
  AND (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id))
);

-- Photos: public only when approved on a public business; owners and admins see all of theirs.
DROP POLICY IF EXISTS business_photos_read ON public.business_photos;
CREATE POLICY business_photos_read ON public.business_photos FOR SELECT USING (
  (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.status = 'active') AND review_status = 'approved')
  OR private.is_revmate_admin((SELECT auth.uid()))
  OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION private.stamp_business_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  is_admin boolean := private.is_revmate_admin(me);
  is_owner boolean;
  n int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Only the caption and order can change (admins also decide the review status).
    NEW.business_id := OLD.business_id; NEW.review_id := OLD.review_id;
    NEW.uploaded_by := OLD.uploaded_by; NEW.source := OLD.source;
    NEW.url := OLD.url; NEW.created_at := OLD.created_at;
    IF NOT is_admin AND current_setting('revmate.business_rpc', true) IS DISTINCT FROM 'on' THEN
      NEW.review_status := OLD.review_status;
    END IF;
    RETURN NEW;
  END IF;

  IF me IS NULL THEN RETURN NEW; END IF; -- server-side import
  NEW.uploaded_by := me;
  NEW.created_at := now();
  SELECT b.owner_user_id = me INTO is_owner FROM public.businesses b WHERE b.id = NEW.business_id;

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
    IF NOT is_admin THEN
      SELECT count(*) INTO n FROM public.business_photos
        WHERE business_id = NEW.business_id AND source = 'business' AND created_at > now() - interval '1 day';
      IF n >= 10 THEN RAISE EXCEPTION 'You can add up to 10 photos a day'; END IF;
      NEW.review_status := 'pending';
    ELSE
      NEW.review_status := 'approved';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.business_reviews r
      WHERE r.id = NEW.review_id AND r.user_id = me AND r.business_id = NEW.business_id
    ) THEN
      RAISE EXCEPTION 'You can only add photos to your own review';
    END IF;
    NEW.source := 'customer';
    NEW.review_status := 'approved';
    SELECT count(*) INTO n FROM public.business_photos WHERE review_id = NEW.review_id;
    IF n >= 5 THEN RAISE EXCEPTION 'Up to 5 photos per review'; END IF;
  END IF;
  RETURN NEW;
END; $$;

-- ---------------------------------------------------------------------------
-- 7. RPCs (the only way approval state changes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_business(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  b public.businesses%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN RAISE EXCEPTION 'Please log in'; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR b.owner_user_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF b.approval_status NOT IN ('draft', 'needs_changes') THEN
    RAISE EXCEPTION 'Only a draft, or a business that needs changes, can be submitted';
  END IF;
  IF char_length(btrim(b.name)) < 2 OR b.category IS NULL OR char_length(btrim(coalesce(b.description, ''))) < 20 THEN
    RAISE EXCEPTION 'Add a name, a category and a description of at least 20 characters first';
  END IF;
  IF coalesce(b.town, '') = '' AND b.postcode_district IS NULL THEN
    RAISE EXCEPTION 'Add your town or postcode area first';
  END IF;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  UPDATE public.businesses SET approval_status = 'pending', submitted_at = now(), review_reason = NULL WHERE id = p_id;
  PERFORM private.log_business_event(p_id, 'status', b.approval_status, 'pending', NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_business(p_id uuid, p_decision text, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  b public.businesses%ROWTYPE;
  target text;
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF p_decision IN ('needs_changes', 'rejected') AND char_length(btrim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Give the owner a reason';
  END IF;
  IF p_decision = 'approved' AND b.approval_status IN ('pending', 'appealed') THEN target := 'approved';
  ELSIF p_decision = 'needs_changes' AND b.approval_status = 'pending' THEN target := 'needs_changes';
  ELSIF p_decision = 'rejected' AND b.approval_status IN ('pending', 'appealed') THEN target := 'rejected';
  ELSIF p_decision = 'reopen' AND b.approval_status IN ('rejected', 'appealed') THEN target := 'needs_changes';
  ELSE RAISE EXCEPTION 'A % business cannot be %', b.approval_status, p_decision;
  END IF;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  UPDATE public.businesses SET
    approval_status = target,
    approved_at = CASE WHEN target = 'approved' THEN now() ELSE approved_at END,
    approved_by = CASE WHEN target = 'approved' THEN me ELSE approved_by END,
    legacy_approved = CASE WHEN target = 'approved' THEN false ELSE legacy_approved END,
    review_reason = CASE WHEN target = 'approved' THEN NULL ELSE p_reason END,
    appeal_used = CASE WHEN p_decision = 'reopen' THEN false ELSE appeal_used END
  WHERE id = p_id;
  PERFORM private.log_business_event(p_id, 'status', b.approval_status, target, p_reason);
END; $$;

CREATE OR REPLACE FUNCTION public.appeal_business(p_id uuid, p_message text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  b public.businesses%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN RAISE EXCEPTION 'Please log in'; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR b.owner_user_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF b.approval_status <> 'rejected' OR b.appeal_used THEN
    RAISE EXCEPTION 'This business cannot be appealed';
  END IF;
  IF char_length(btrim(coalesce(p_message, ''))) < 10 THEN RAISE EXCEPTION 'Tell us why we should look again'; END IF;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  UPDATE public.businesses SET approval_status = 'appealed', appeal_message = left(p_message, 1000), appeal_used = true WHERE id = p_id;
  PERFORM private.log_business_event(p_id, 'status', 'rejected', 'appealed', left(p_message, 1000));
END; $$;

CREATE OR REPLACE FUNCTION public.set_business_suspended(p_id uuid, p_suspend boolean, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_suspend AND char_length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give a reason'; END IF;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  UPDATE public.businesses SET
    suspended_at = CASE WHEN p_suspend THEN now() ELSE NULL END,
    suspended_reason = CASE WHEN p_suspend THEN p_reason ELSE NULL END
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
  PERFORM private.log_business_event(p_id, 'suspension', NULL, CASE WHEN p_suspend THEN 'suspended' ELSE 'reinstated' END, p_reason);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_confirm_legacy_business(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.is_revmate_admin((SELECT auth.uid())) THEN RAISE EXCEPTION 'Admins only'; END IF;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  UPDATE public.businesses SET legacy_approved = false WHERE id = p_id AND legacy_approved;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a legacy approval'; END IF;
  PERFORM private.log_business_event(p_id, 'legacy_review', 'approved', 'approved', 'Legacy approval reviewed and confirmed');
END; $$;

CREATE OR REPLACE FUNCTION public.request_business_tier(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  b public.businesses%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN RAISE EXCEPTION 'Please log in'; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = p_id;
  IF NOT FOUND OR b.owner_user_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF b.approval_status <> 'approved' OR b.suspended_at IS NOT NULL THEN
    RAISE EXCEPTION 'Only an approved business can request an upgrade';
  END IF;
  IF b.tier = 'full' THEN RAISE EXCEPTION 'Already a full business'; END IF;
  INSERT INTO public.business_tier_requests (business_id, requested_by) VALUES (p_id, me);
  PERFORM private.log_business_event(p_id, 'tier', 'listing', 'full requested', NULL);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'An upgrade request is already waiting';
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_tier_request(p_request uuid, p_decision text, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  r public.business_tier_requests%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  IF p_decision = 'rejected' AND char_length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give the owner a reason'; END IF;
  SELECT * INTO r FROM public.business_tier_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
  UPDATE public.business_tier_requests SET status = p_decision, reason = p_reason, reviewed_by = me, reviewed_at = now() WHERE id = p_request;
  IF p_decision = 'approved' THEN
    PERFORM set_config('revmate.business_rpc', 'on', true);
    UPDATE public.businesses SET tier = 'full' WHERE id = r.business_id;
  END IF;
  PERFORM private.log_business_event(r.business_id, 'tier', 'listing', CASE WHEN p_decision = 'approved' THEN 'full' ELSE 'upgrade rejected' END, p_reason);
END; $$;

CREATE OR REPLACE FUNCTION public.submit_business_revision(p_id uuid, p_fields jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  b public.businesses%ROWTYPE;
  allowed text[] := ARRAY['name', 'category', 'description', 'logo_url', 'website', 'address', 'phone', 'email', 'services'];
  cleaned jsonb := '{}'::jsonb;
  k text;
  new_id uuid;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN RAISE EXCEPTION 'Please log in'; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = p_id;
  IF NOT FOUND OR b.owner_user_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF b.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved business needs changes submitted for review';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
    IF k = ANY (allowed) THEN cleaned := cleaned || jsonb_build_object(k, p_fields -> k); END IF;
  END LOOP;
  IF cleaned = '{}'::jsonb THEN RAISE EXCEPTION 'No changes to submit'; END IF;
  IF cleaned ? 'name' AND char_length(btrim(cleaned ->> 'name')) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Name must be 2 to 100 characters'; END IF;
  IF cleaned ? 'description' AND char_length(coalesce(cleaned ->> 'description', '')) > 2000 THEN RAISE EXCEPTION 'Description is too long'; END IF;
  IF cleaned ? 'logo_url' AND coalesce(cleaned ->> 'logo_url', '') <> '' AND cleaned ->> 'logo_url' !~ '^https://' THEN RAISE EXCEPTION 'Logo must be an https link'; END IF;
  IF cleaned ? 'website' AND coalesce(cleaned ->> 'website', '') <> '' AND cleaned ->> 'website' !~ '^https://' THEN RAISE EXCEPTION 'Website must start with https://'; END IF;
  UPDATE public.business_revisions SET status = 'withdrawn', reviewed_at = now() WHERE business_id = p_id AND status = 'pending';
  INSERT INTO public.business_revisions (business_id, proposed, submitted_by) VALUES (p_id, cleaned, me) RETURNING id INTO new_id;
  PERFORM private.log_business_event(p_id, 'revision', 'approved', 'changes submitted', NULL);
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.withdraw_business_revision(p_revision uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
BEGIN
  UPDATE public.business_revisions r SET status = 'withdrawn', reviewed_at = now()
  WHERE r.id = p_revision AND r.status = 'pending'
    AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = r.business_id AND b.owner_user_id = me);
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending change found'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_revision(p_revision uuid, p_decision text, p_reason text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  r public.business_revisions%ROWTYPE;
  p jsonb;
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  IF p_decision = 'rejected' AND char_length(btrim(coalesce(p_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give the owner a reason'; END IF;
  SELECT * INTO r FROM public.business_revisions WHERE id = p_revision FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Change not found or already reviewed'; END IF;
  p := r.proposed;
  IF p_decision = 'approved' THEN
    PERFORM set_config('revmate.business_rpc', 'on', true);
    UPDATE public.businesses SET
      name = CASE WHEN p ? 'name' THEN btrim(p ->> 'name') ELSE name END,
      category = CASE WHEN p ? 'category' THEN p ->> 'category' ELSE category END,
      description = CASE WHEN p ? 'description' THEN p ->> 'description' ELSE description END,
      logo_url = CASE WHEN p ? 'logo_url' THEN nullif(p ->> 'logo_url', '') ELSE logo_url END,
      website = CASE WHEN p ? 'website' THEN nullif(p ->> 'website', '') ELSE website END,
      address = CASE WHEN p ? 'address' THEN nullif(p ->> 'address', '') ELSE address END,
      phone = CASE WHEN p ? 'phone' THEN nullif(p ->> 'phone', '') ELSE phone END,
      email = CASE WHEN p ? 'email' THEN nullif(p ->> 'email', '') ELSE email END,
      services = CASE WHEN p ? 'services' THEN ARRAY(SELECT jsonb_array_elements_text(p -> 'services')) ELSE services END
    WHERE id = r.business_id;
  END IF;
  UPDATE public.business_revisions SET status = p_decision, reason = p_reason, reviewed_by = me, reviewed_at = now() WHERE id = p_revision;
  PERFORM private.log_business_event(r.business_id, 'revision', 'changes submitted', p_decision, p_reason);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_photo(p_photo uuid, p_decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.is_revmate_admin((SELECT auth.uid())) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  UPDATE public.business_photos SET review_status = p_decision WHERE id = p_photo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Photo not found'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_photo_report(p_report uuid, p_decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  rep public.business_photo_reports%ROWTYPE;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.is_revmate_admin((SELECT auth.uid())) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('upheld', 'dismissed') THEN RAISE EXCEPTION 'Decision must be upheld or dismissed'; END IF;
  SELECT * INTO rep FROM public.business_photo_reports WHERE id = p_report FOR UPDATE;
  IF NOT FOUND OR rep.status <> 'open' THEN RAISE EXCEPTION 'Report not found or already resolved'; END IF;
  UPDATE public.business_photo_reports SET status = p_decision WHERE id = p_report;
  IF p_decision = 'upheld' THEN
    PERFORM set_config('revmate.business_rpc', 'on', true);
    UPDATE public.business_photos SET review_status = 'rejected' WHERE id = rep.photo_id;
  END IF;
END; $$;

-- A count only, never a list of followers.
CREATE OR REPLACE FUNCTION public.business_follower_count(p_business uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = p_business
        AND (b.status = 'active' OR b.owner_user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid()))))
    THEN (SELECT count(*)::int FROM public.business_follows f WHERE f.business_id = p_business)
    ELSE 0 END
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.submit_business(uuid)', 'public.admin_review_business(uuid, text, text)', 'public.appeal_business(uuid, text)',
    'public.set_business_suspended(uuid, boolean, text)', 'public.request_business_tier(uuid)',
    'public.admin_review_tier_request(uuid, text, text)', 'public.submit_business_revision(uuid, jsonb)',
    'public.withdraw_business_revision(uuid)', 'public.admin_review_revision(uuid, text, text)',
    'public.admin_review_photo(uuid, text)', 'public.admin_resolve_photo_report(uuid, text)',
    'public.business_follower_count(uuid)', 'public.admin_confirm_legacy_business(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.business_follower_count(uuid) TO anon;

-- ---------------------------------------------------------------------------
-- 8. Feature check: the app turns the new tools on only when this says true
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_foundation_ready() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'businesses'
         AND column_name IN ('approval_status', 'suspended_at', 'tier', 'legacy_approved', 'review_reason', 'appeal_used')) = 6
    AND (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'business_photos' AND column_name = 'review_status') = 1
    AND to_regclass('public.business_approval_log') IS NOT NULL
    AND to_regclass('public.business_revisions') IS NOT NULL
    AND to_regclass('public.business_tier_requests') IS NOT NULL
    AND to_regclass('public.business_follows') IS NOT NULL
    AND to_regclass('public.business_photo_reports') IS NOT NULL
    AND (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN (
         'submit_business', 'admin_review_business', 'appeal_business', 'set_business_suspended',
         'request_business_tier', 'admin_review_tier_request', 'submit_business_revision',
         'withdraw_business_revision', 'admin_review_revision', 'admin_review_photo',
         'admin_resolve_photo_report', 'business_follower_count', 'admin_confirm_legacy_business')) = 13
    AND (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'public.businesses'::regclass AND NOT t.tgisinternal
         AND t.tgname IN ('guard_business_insert', 'enforce_business_transition', 'sync_business_status', 'guard_business_owner_edit')) = 4
    AND EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'businesses' AND policyname = 'businesses_owner_insert'
         AND with_check LIKE '%draft%')
    AND EXISTS (SELECT 1 FROM public.schema_features WHERE name = 'business_foundation')
$$;
GRANT EXECUTE ON FUNCTION public.business_foundation_ready() TO anon, authenticated;

INSERT INTO public.schema_features (name, version) VALUES ('business_foundation', 1)
ON CONFLICT (name) DO UPDATE SET version = EXCLUDED.version, applied_at = now();
