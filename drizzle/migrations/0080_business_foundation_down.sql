-- Rollback for 0080_business_foundation.sql.
--
-- This NEVER drops tables or columns and never deletes rows, so everything collected since the
-- migration (approval log, revisions, tier requests, follows, photo reports, review statuses) is kept
-- for a later re-run. It only switches the new behaviour off:
--   * removes the new triggers, review functions and the business_foundation_ready() check, so the
--     app's new tools turn themselves off (the app treats a missing/failed check as "off");
--   * puts back the earlier owner-edit guard and photo trigger;
--   * keeps owner self-service creation CLOSED (the old policy let a new business go live instantly;
--     restoring that would reopen the hole). Admins can still create businesses.
-- Businesses that are not approved keep status = 'suspended', so they stay hidden after a rollback.
-- Photos still waiting for review stay hidden until an admin sets review_status = 'approved'.
-- To restore the old "owners create businesses that go live at once" behaviour you must do it by hand;
-- it is deliberately not part of the rollback.

DROP TRIGGER IF EXISTS guard_business_insert ON public.businesses;
DROP TRIGGER IF EXISTS enforce_business_transition ON public.businesses;
DROP TRIGGER IF EXISTS sync_business_status ON public.businesses;

-- Earlier owner-edit guard (from 0071).
CREATE OR REPLACE FUNCTION private.guard_business_owner_edit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR private.is_revmate_admin((SELECT auth.uid())) THEN RETURN NEW; END IF;
  NEW.id := OLD.id;
  NEW.verified := OLD.verified;
  NEW.status := OLD.status;
  NEW.owner_user_id := OLD.owner_user_id;
  NEW.promoted_until := OLD.promoted_until;
  NEW.created_at := OLD.created_at;
  -- Approval fields stay protected even in a rollback.
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
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.guard_business_owner_edit() FROM PUBLIC, anon, authenticated;

-- Owners can no longer create businesses while the approval system is off.
DROP POLICY IF EXISTS businesses_owner_insert ON public.businesses;

-- Earlier photo trigger (from 0070): new owner photos go live straight away again.
CREATE OR REPLACE FUNCTION private.stamp_business_photo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  is_admin boolean := private.is_revmate_admin(me);
  is_owner boolean;
  n int;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.business_id := OLD.business_id; NEW.review_id := OLD.review_id;
    NEW.uploaded_by := OLD.uploaded_by; NEW.source := OLD.source;
    NEW.url := OLD.url; NEW.created_at := OLD.created_at;
    IF NOT is_admin THEN NEW.review_status := OLD.review_status; END IF;
    RETURN NEW;
  END IF;
  IF me IS NULL THEN RETURN NEW; END IF;
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
    SELECT count(*) INTO n FROM public.business_photos WHERE business_id = NEW.business_id AND source = 'business';
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

-- Review functions and the feature check: gone, so the app switches the new tools off.
DROP FUNCTION IF EXISTS public.business_foundation_ready();
DROP FUNCTION IF EXISTS public.submit_business(uuid);
DROP FUNCTION IF EXISTS public.admin_review_business(uuid, text, text);
DROP FUNCTION IF EXISTS public.appeal_business(uuid, text);
DROP FUNCTION IF EXISTS public.set_business_suspended(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.request_business_tier(uuid);
DROP FUNCTION IF EXISTS public.admin_review_tier_request(uuid, text, text);
DROP FUNCTION IF EXISTS public.submit_business_revision(uuid, jsonb);
DROP FUNCTION IF EXISTS public.withdraw_business_revision(uuid);
DROP FUNCTION IF EXISTS public.admin_review_revision(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_review_photo(uuid, text);
DROP FUNCTION IF EXISTS public.admin_resolve_photo_report(uuid, text);
DROP FUNCTION IF EXISTS public.admin_confirm_legacy_business(uuid);
DROP FUNCTION IF EXISTS public.business_follower_count(uuid);
DELETE FROM public.schema_features WHERE name = 'business_foundation';

-- Tables, columns and rows added by 0080 are intentionally left in place.
