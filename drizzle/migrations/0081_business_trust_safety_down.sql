-- Rollback for 0081_business_trust_safety.sql.
--
-- Never drops tables, columns or rows: flags, review reports, appeals, hidden reviews and the
-- recomputed scores all stay for a later re-run. It only switches the new behaviour off:
--   * removes the new triggers (flags, daily caps, report logging) and the new RPCs / readiness check,
--     so the app turns the trust tools off;
--   * restores the earlier stats, counter-guard and review triggers (plain average, as before);
--   * restores the 0080 business-creation guard (without the email / account-age checks).
-- Hidden reviews STAY hidden (the stricter review read policy is kept on purpose), so a rollback never
-- brings back a review an admin removed. Counters keep their current values until the next review or
-- report changes them; the numbers from before 0081 are in business_trust_backup_20261115.

DROP TRIGGER IF EXISTS flag_review ON public.business_reviews;
DROP TRIGGER IF EXISTS cap_business_reports ON public.business_reports;
DROP TRIGGER IF EXISTS cap_review_reports ON public.review_reports;
DROP TRIGGER IF EXISTS cap_photo_reports ON public.business_photo_reports;
DROP TRIGGER IF EXISTS log_report_decision ON public.business_reports;

-- Earlier stats trigger (0046): plain average of all reviews; open reports count too.
CREATE OR REPLACE FUNCTION private.refresh_business_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE target uuid := coalesce(NEW.business_id, OLD.business_id);
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.businesses b SET
    reviews_count = (SELECT count(*) FROM public.business_reviews r WHERE r.business_id = target AND r.hidden_at IS NULL),
    rating_avg = coalesce((SELECT round(avg(r.rating)::numeric, 2) FROM public.business_reviews r WHERE r.business_id = target AND r.hidden_at IS NULL), 0),
    reports_count = (SELECT count(*) FROM public.business_reports r WHERE r.business_id = target AND r.status <> 'dismissed')
  WHERE b.id = target;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN NULL;
END; $$;

-- Earlier counter guard (0046) plus the new score columns, which stay protected.
CREATE OR REPLACE FUNCTION private.guard_business() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) IS DISTINCT FROM 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.rating_avg := 0; NEW.reviews_count := 0; NEW.reports_count := 0;
      NEW.rating_score := 0; NEW.trust_level := 'new';
    ELSE
      NEW.rating_avg := OLD.rating_avg; NEW.reviews_count := OLD.reviews_count;
      NEW.reports_count := OLD.reports_count;
      NEW.rating_score := OLD.rating_score; NEW.trust_level := OLD.trust_level;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- Earlier review stamp (0046), but hidden-review columns stay protected.
CREATE OR REPLACE FUNCTION private.stamp_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  trusted_caller boolean := me IS NULL OR private.is_revmate_admin(me)
    OR current_setting('revmate.business_rpc', true) = 'on';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.business_id := OLD.business_id; NEW.user_id := OLD.user_id; NEW.created_at := OLD.created_at;
    IF NOT trusted_caller THEN
      NEW.hidden_at := OLD.hidden_at; NEW.hidden_reason := OLD.hidden_reason;
      NEW.hidden_by := OLD.hidden_by; NEW.admin_cleared := OLD.admin_cleared;
    END IF;
  ELSIF NOT trusted_caller THEN
    NEW.hidden_at := NULL; NEW.hidden_reason := NULL; NEW.hidden_by := NULL; NEW.admin_cleared := false;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- The 0080 creation guard (no email / account-age checks).
CREATE OR REPLACE FUNCTION private.guard_business_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
BEGIN
  IF me IS NULL OR private.is_revmate_admin(me) THEN
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

DROP FUNCTION IF EXISTS public.business_trust_ready();
DROP FUNCTION IF EXISTS public.admin_resolve_review_report(uuid, text, text);
DROP FUNCTION IF EXISTS public.admin_resolve_flag(uuid, text, text);
DROP FUNCTION IF EXISTS public.appeal_decision(uuid, text, uuid, text);
DROP FUNCTION IF EXISTS public.admin_resolve_appeal(uuid, text, text);
DROP FUNCTION IF EXISTS public.business_activity(uuid);
DELETE FROM public.schema_features WHERE name = 'business_trust';

-- Tables, columns and rows added by 0081 are intentionally left in place.
