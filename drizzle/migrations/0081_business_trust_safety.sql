-- Business trust and safety (Phase 2). Requires 0080_business_foundation.sql.
-- Additive and reversible (0081_business_trust_safety_down.sql); nothing is dropped.
--
-- * Ratings: rating_avg is the plain average of reviews that count; rating_score is a smoothed
--   (Bayesian) score used for ranking and the trust level, so one 5-star review can't outrank
--   forty good ones. Hidden reviews and reviews waiting on a conflict-of-interest check don't count.
-- * reports_count now counts UPHELD reports only (it used to include open ones).
-- * Conflict-of-interest and burst flags go to an admin queue. NOTHING is suspended automatically.
-- * Members and owners can report a single review; admins can hide it; owners can appeal decisions.
-- * Spam limits: daily caps on reviews and reports, and an account must be a day old with a
--   confirmed email before it can create a business.

-- ---------------------------------------------------------------------------
-- 0. Snapshot the numbers we are about to recompute
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.business_trust_backup_20261115 AS
  SELECT id, rating_avg, reviews_count, reports_count FROM public.businesses;
ALTER TABLE public.business_trust_backup_20261115 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_trust_backup_20261115 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.business_trust_backup_20261115 TO service_role;

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS rating_score numeric(5, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_level text NOT NULL DEFAULT 'new';
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_trust_level_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_trust_level_check CHECK (trust_level IN ('new', 'trusted', 'caution'));

ALTER TABLE public.business_reviews
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_cleared boolean NOT NULL DEFAULT false;

-- Log entries can point at what they are about, so owners can appeal them.
ALTER TABLE public.business_approval_log
  ADD COLUMN IF NOT EXISTS ref_kind text,
  ADD COLUMN IF NOT EXISTS ref_id uuid;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
-- Things that need a person to look: possible conflicts of interest and review bursts.
CREATE TABLE IF NOT EXISTS public.business_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.business_reviews(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('new_account', 'linked_account', 'review_burst')),
  detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'confirmed')),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS business_flags_review_kind ON public.business_flags (review_id, kind) WHERE review_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_flags_burst_daily ON public.business_flags (business_id, kind, ((created_at AT TIME ZONE 'UTC')::date)) WHERE kind = 'review_burst';
CREATE INDEX IF NOT EXISTS business_flags_open_idx ON public.business_flags (status, created_at);
ALTER TABLE public.business_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_flags TO authenticated;
GRANT ALL ON public.business_flags TO service_role;
DROP POLICY IF EXISTS business_flags_admin_read ON public.business_flags;
CREATE POLICY business_flags_admin_read ON public.business_flags FOR SELECT TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid())));

-- Reports against one review (from members, or from the business it is about).
CREATE TABLE IF NOT EXISTS public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.business_reviews(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('fake', 'abusive', 'not_a_customer', 'off_topic', 'other')),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, reporter_id)
);
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;
DROP POLICY IF EXISTS review_reports_read ON public.review_reports;
CREATE POLICY review_reports_read ON public.review_reports FOR SELECT TO authenticated
  USING (reporter_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())));
DROP POLICY IF EXISTS review_reports_insert ON public.review_reports;
CREATE POLICY review_reports_insert ON public.review_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid()) AND private.is_active_account((SELECT auth.uid())) AND status = 'open'
    AND EXISTS (SELECT 1 FROM public.business_reviews r
      WHERE r.id = review_id AND r.user_id <> (SELECT auth.uid())));

-- Owners can appeal a decision against them; an admin makes the final call.
CREATE TABLE IF NOT EXISTS public.business_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  ref_kind text NOT NULL CHECK (ref_kind IN ('report', 'flag', 'review', 'suspension')),
  ref_id uuid NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'upheld', 'dismissed')),
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 1000),
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  decided_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS business_appeals_one_per_decision ON public.business_appeals (ref_kind, ref_id);
ALTER TABLE public.business_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.business_appeals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.business_appeals TO authenticated;
GRANT ALL ON public.business_appeals TO service_role;
DROP POLICY IF EXISTS business_appeals_read ON public.business_appeals;
CREATE POLICY business_appeals_read ON public.business_appeals FOR SELECT TO authenticated
  USING (private.is_revmate_admin((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.owner_user_id = (SELECT auth.uid())));

-- ---------------------------------------------------------------------------
-- 3. Trust maths
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.compute_trust(p_avg numeric, p_count int, p_upheld int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_count >= 3 AND (p_avg < 2.5 OR p_upheld >= 3) THEN 'caution'
    WHEN p_count >= 5 AND p_avg >= 4.3 AND p_upheld = 0 THEN 'trusted'
    ELSE 'new' END
$$;

CREATE OR REPLACE FUNCTION private.recompute_business_stats(p_business uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_n int; v_avg numeric; v_up int;
BEGIN
  -- A review counts unless it is hidden or still waiting on a conflict-of-interest check.
  SELECT count(*), coalesce(avg(r.rating), 0) INTO v_n, v_avg
  FROM public.business_reviews r
  WHERE r.business_id = p_business AND r.hidden_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.business_flags f
      WHERE f.review_id = r.id AND f.kind IN ('new_account', 'linked_account') AND f.status = 'open');
  SELECT count(*) INTO v_up FROM public.business_reports WHERE business_id = p_business AND status = 'upheld';
  PERFORM set_config('revmate.counter_update', 'on', true);
  UPDATE public.businesses SET
    reviews_count = v_n,
    rating_avg = round(v_avg, 2),
    rating_score = round((3 * 3.5 + v_n * v_avg) / (3 + v_n), 3),
    reports_count = v_up,
    trust_level = private.compute_trust(round(v_avg, 2), v_n, v_up)
  WHERE id = p_business;
  PERFORM set_config('revmate.counter_update', 'off', true);
END; $$;
REVOKE ALL ON FUNCTION private.recompute_business_stats(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.refresh_business_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.recompute_business_stats(coalesce(NEW.business_id, OLD.business_id));
  RETURN NULL;
END; $$;

-- The counters (and the new score columns) can't be edited by hand.
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

-- ---------------------------------------------------------------------------
-- 4. Review rules: hidden reviews stay hidden, spam caps, flags
-- ---------------------------------------------------------------------------
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
    IF (SELECT count(*) FROM public.business_reviews r
        WHERE r.user_id = NEW.user_id AND r.created_at > now() - interval '1 day') >= 5 THEN
      RAISE EXCEPTION 'You can leave up to 5 reviews a day';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION private.cap_reports() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  who uuid := NEW.reporter_id;
  n int;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR private.is_revmate_admin((SELECT auth.uid())) THEN RETURN NEW; END IF;
  SELECT (SELECT count(*) FROM public.business_reports WHERE reporter_id = who AND created_at > now() - interval '1 day')
       + (SELECT count(*) FROM public.review_reports WHERE reporter_id = who AND created_at > now() - interval '1 day')
       + (SELECT count(*) FROM public.business_photo_reports WHERE reporter_id = who AND created_at > now() - interval '1 day')
  INTO n;
  IF n >= 10 THEN RAISE EXCEPTION 'You can send up to 10 reports a day'; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.cap_reports() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS cap_business_reports ON public.business_reports;
CREATE TRIGGER cap_business_reports BEFORE INSERT ON public.business_reports FOR EACH ROW EXECUTE FUNCTION private.cap_reports();
DROP TRIGGER IF EXISTS cap_review_reports ON public.review_reports;
CREATE TRIGGER cap_review_reports BEFORE INSERT ON public.review_reports FOR EACH ROW EXECUTE FUNCTION private.cap_reports();
DROP TRIGGER IF EXISTS cap_photo_reports ON public.business_photo_reports;
CREATE TRIGGER cap_photo_reports BEFORE INSERT ON public.business_photo_reports FOR EACH ROW EXECUTE FUNCTION private.cap_reports();

-- Flag reviews that need a person to look (never suspends anyone).
CREATE OR REPLACE FUNCTION private.flag_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owner_id uuid;
  owner_domain text;
  reviewer_domain text;
  reviewer_created timestamptz;
  recent int;
  generic text[] := ARRAY['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com', 'hotmail.co.uk',
    'outlook.com', 'live.com', 'live.co.uk', 'icloud.com', 'me.com', 'aol.com', 'btinternet.com', 'sky.com',
    'proton.me', 'protonmail.com', 'msn.com', 'talktalk.net', 'virginmedia.com'];
BEGIN
  SELECT b.owner_user_id INTO owner_id FROM public.businesses b WHERE b.id = NEW.business_id;
  SELECT p.created_at INTO reviewer_created FROM public.profiles p WHERE p.user_id = NEW.user_id;

  IF reviewer_created IS NOT NULL AND reviewer_created > now() - interval '3 days' THEN
    INSERT INTO public.business_flags (business_id, review_id, kind, detail)
    VALUES (NEW.business_id, NEW.id, 'new_account', 'Reviewer joined less than 3 days ago')
    ON CONFLICT DO NOTHING;
  END IF;

  IF owner_id IS NOT NULL THEN
    SELECT lower(split_part(u.email, '@', 2)) INTO owner_domain FROM auth.users u WHERE u.id = owner_id;
    SELECT lower(split_part(u.email, '@', 2)) INTO reviewer_domain FROM auth.users u WHERE u.id = NEW.user_id;
    IF coalesce(owner_domain, '') <> '' AND owner_domain = reviewer_domain AND NOT (owner_domain = ANY (generic)) THEN
      INSERT INTO public.business_flags (business_id, review_id, kind, detail)
      VALUES (NEW.business_id, NEW.id, 'linked_account', 'Reviewer and owner share the email domain ' || owner_domain)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  SELECT count(*) INTO recent FROM public.business_reviews r
  WHERE r.business_id = NEW.business_id AND r.created_at > now() - interval '1 day';
  IF recent >= 5 THEN
    INSERT INTO public.business_flags (business_id, kind, detail)
    VALUES (NEW.business_id, 'review_burst', recent || ' reviews in the last 24 hours')
    ON CONFLICT DO NOTHING;
  END IF;

  PERFORM private.recompute_business_stats(NEW.business_id);
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION private.flag_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS flag_review ON public.business_reviews;
CREATE TRIGGER flag_review AFTER INSERT ON public.business_reviews FOR EACH ROW EXECUTE FUNCTION private.flag_review();

-- Log an upheld/dismissed business report so the owner can see and appeal it.
CREATE OR REPLACE FUNCTION private.log_report_decision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('upheld', 'dismissed') THEN
    INSERT INTO public.business_approval_log (business_id, actor_id, kind, from_status, to_status, reason, ref_kind, ref_id)
    VALUES (NEW.business_id, (SELECT auth.uid()), CASE WHEN NEW.status = 'upheld' THEN 'report_upheld' ELSE 'report_dismissed' END,
      OLD.status, NEW.status, 'A report about "' || NEW.reason || '" was ' || NEW.status, 'report', NEW.id);
  END IF;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION private.log_report_decision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS log_report_decision ON public.business_reports;
CREATE TRIGGER log_report_decision AFTER UPDATE OF status ON public.business_reports
  FOR EACH ROW EXECUTE FUNCTION private.log_report_decision();

-- Business creation needs a day-old account with a confirmed email (admins exempt).
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
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = me AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirm your email address before adding a business';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = me AND p.created_at <= now() - interval '1 day') THEN
    RAISE EXCEPTION 'New accounts can add a business after their first day';
  END IF;
  IF (SELECT count(*) FROM public.businesses b
        WHERE b.owner_user_id = NEW.owner_user_id AND b.approval_status <> 'rejected') >= 3 THEN
    RAISE EXCEPTION 'You can have up to 3 businesses';
  END IF;
  RETURN NEW;
END; $$;

-- Hidden reviews are visible only to their author and admins.
DROP POLICY IF EXISTS reviews_read ON public.business_reviews;
CREATE POLICY reviews_read ON public.business_reviews FOR SELECT USING (
  (private.is_active_account(user_id) OR user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid())))
  AND (user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid()))
       OR (hidden_at IS NULL AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id)))
);

-- ---------------------------------------------------------------------------
-- 5. RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_resolve_review_report(p_report uuid, p_decision text, p_note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  rep public.review_reports%ROWTYPE;
  rev public.business_reviews%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('upheld', 'dismissed') THEN RAISE EXCEPTION 'Decision must be upheld or dismissed'; END IF;
  SELECT * INTO rep FROM public.review_reports WHERE id = p_report FOR UPDATE;
  IF NOT FOUND OR rep.status <> 'open' THEN RAISE EXCEPTION 'Report not found or already resolved'; END IF;
  UPDATE public.review_reports SET status = p_decision WHERE id = p_report;
  IF p_decision = 'upheld' THEN
    SELECT * INTO rev FROM public.business_reviews WHERE id = rep.review_id;
    PERFORM set_config('revmate.business_rpc', 'on', true);
    UPDATE public.business_reviews SET hidden_at = now(), hidden_reason = coalesce(p_note, 'Removed after a report'), hidden_by = me
    WHERE id = rep.review_id;
    INSERT INTO public.business_approval_log (business_id, actor_id, kind, from_status, to_status, reason, ref_kind, ref_id)
    VALUES (rev.business_id, me, 'review_hidden', 'visible', 'hidden', coalesce(p_note, 'A review was removed after a report'), 'review', rev.id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_flag(p_flag uuid, p_decision text, p_note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  fl public.business_flags%ROWTYPE;
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('cleared', 'confirmed') THEN RAISE EXCEPTION 'Decision must be cleared or confirmed'; END IF;
  SELECT * INTO fl FROM public.business_flags WHERE id = p_flag FOR UPDATE;
  IF NOT FOUND OR fl.status <> 'open' THEN RAISE EXCEPTION 'Flag not found or already resolved'; END IF;
  UPDATE public.business_flags SET status = p_decision, note = p_note, reviewed_by = me, reviewed_at = now() WHERE id = p_flag;
  PERFORM set_config('revmate.business_rpc', 'on', true);
  IF fl.review_id IS NOT NULL THEN
    IF p_decision = 'cleared' THEN
      UPDATE public.business_reviews SET admin_cleared = true WHERE id = fl.review_id;
    ELSE
      UPDATE public.business_reviews SET hidden_at = now(), hidden_reason = coalesce(p_note, 'Removed after a conflict-of-interest check'), hidden_by = me
      WHERE id = fl.review_id;
    END IF;
  END IF;
  IF p_decision = 'confirmed' THEN
    INSERT INTO public.business_approval_log (business_id, actor_id, kind, from_status, to_status, reason, ref_kind, ref_id)
    VALUES (fl.business_id, me, 'flag_confirmed', 'open', 'confirmed', coalesce(p_note, fl.detail), 'flag', fl.id);
  END IF;
  PERFORM private.recompute_business_stats(fl.business_id);
END; $$;

CREATE OR REPLACE FUNCTION public.appeal_decision(p_business uuid, p_ref_kind text, p_ref_id uuid, p_message text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  b public.businesses%ROWTYPE;
  ok boolean := false;
  new_id uuid;
BEGIN
  IF me IS NULL OR NOT private.is_active_account(me) THEN RAISE EXCEPTION 'Please log in'; END IF;
  SELECT * INTO b FROM public.businesses WHERE id = p_business;
  IF NOT FOUND OR b.owner_user_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'Business not found'; END IF;
  IF char_length(btrim(coalesce(p_message, ''))) < 10 THEN RAISE EXCEPTION 'Tell us why we should look again'; END IF;
  IF p_ref_kind = 'report' THEN
    ok := EXISTS (SELECT 1 FROM public.business_reports WHERE id = p_ref_id AND business_id = p_business AND status = 'upheld');
  ELSIF p_ref_kind = 'flag' THEN
    ok := EXISTS (SELECT 1 FROM public.business_flags WHERE id = p_ref_id AND business_id = p_business AND status = 'confirmed');
  ELSIF p_ref_kind = 'review' THEN
    ok := EXISTS (SELECT 1 FROM public.business_reviews WHERE id = p_ref_id AND business_id = p_business AND hidden_at IS NOT NULL);
  ELSIF p_ref_kind = 'suspension' THEN
    ok := p_ref_id = p_business AND b.suspended_at IS NOT NULL;
  END IF;
  IF NOT ok THEN RAISE EXCEPTION 'That decision can''t be appealed'; END IF;
  INSERT INTO public.business_appeals (business_id, ref_kind, ref_id, message, created_by)
  VALUES (p_business, p_ref_kind, p_ref_id, left(btrim(p_message), 1000), me) RETURNING id INTO new_id;
  PERFORM private.log_business_event(p_business, 'appeal', p_ref_kind, 'open', left(btrim(p_message), 1000));
  RETURN new_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This decision has already been appealed';
END; $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_appeal(p_appeal uuid, p_decision text, p_note text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  me uuid := (SELECT auth.uid());
  a public.business_appeals%ROWTYPE;
  rid uuid;
BEGIN
  IF me IS NULL OR NOT private.is_revmate_admin(me) THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_decision NOT IN ('upheld', 'dismissed') THEN RAISE EXCEPTION 'Decision must be upheld or dismissed'; END IF;
  IF char_length(btrim(coalesce(p_note, ''))) < 3 THEN RAISE EXCEPTION 'Explain the decision to the owner'; END IF;
  SELECT * INTO a FROM public.business_appeals WHERE id = p_appeal FOR UPDATE;
  IF NOT FOUND OR a.status <> 'open' THEN RAISE EXCEPTION 'Appeal not found or already decided'; END IF;
  UPDATE public.business_appeals SET status = p_decision, decision_note = p_note, decided_by = me, decided_at = now() WHERE id = p_appeal;
  IF p_decision = 'upheld' THEN
    PERFORM set_config('revmate.business_rpc', 'on', true);
    IF a.ref_kind = 'report' THEN
      UPDATE public.business_reports SET status = 'dismissed' WHERE id = a.ref_id;
    ELSIF a.ref_kind = 'flag' THEN
      UPDATE public.business_flags SET status = 'cleared', note = p_note, reviewed_by = me, reviewed_at = now() WHERE id = a.ref_id
      RETURNING review_id INTO rid;
      IF rid IS NOT NULL THEN
        UPDATE public.business_reviews SET hidden_at = NULL, hidden_reason = NULL, hidden_by = NULL, admin_cleared = true WHERE id = rid;
      END IF;
    ELSIF a.ref_kind = 'review' THEN
      UPDATE public.business_reviews SET hidden_at = NULL, hidden_reason = NULL, hidden_by = NULL, admin_cleared = true WHERE id = a.ref_id;
    ELSIF a.ref_kind = 'suspension' THEN
      UPDATE public.businesses SET suspended_at = NULL, suspended_reason = NULL WHERE id = a.business_id;
    END IF;
  END IF;
  PERFORM private.recompute_business_stats(a.business_id);
  INSERT INTO public.business_approval_log (business_id, actor_id, kind, from_status, to_status, reason)
  VALUES (a.business_id, me, 'appeal_result', a.ref_kind, p_decision, p_note);
END; $$;

-- Public activity signals for a visible business (no personal data).
CREATE OR REPLACE FUNCTION public.business_activity(p_business uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN EXISTS (
      SELECT 1 FROM public.businesses b WHERE b.id = p_business
        AND (b.status = 'active' OR b.owner_user_id = (SELECT auth.uid()) OR private.is_revmate_admin((SELECT auth.uid()))))
    THEN jsonb_build_object(
      'followers', (SELECT count(*) FROM public.business_follows f WHERE f.business_id = p_business),
      'reviews', (SELECT count(*) FROM public.business_reviews r WHERE r.business_id = p_business AND r.hidden_at IS NULL),
      'replies', (SELECT count(*) FROM public.business_reviews r WHERE r.business_id = p_business AND r.hidden_at IS NULL AND r.owner_reply IS NOT NULL),
      'last_reply', (SELECT max(r.owner_replied_at) FROM public.business_reviews r WHERE r.business_id = p_business),
      'photos', (SELECT count(*) FROM public.business_photos ph WHERE ph.business_id = p_business AND ph.review_status = 'approved'),
      'last_photo', (SELECT max(ph.created_at) FROM public.business_photos ph WHERE ph.business_id = p_business AND ph.source = 'business' AND ph.review_status = 'approved'))
    ELSE '{}'::jsonb END
$$;

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.admin_resolve_review_report(uuid, text, text)', 'public.admin_resolve_flag(uuid, text, text)',
    'public.appeal_decision(uuid, text, uuid, text)', 'public.admin_resolve_appeal(uuid, text, text)',
    'public.business_activity(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.business_activity(uuid) TO anon;

-- ---------------------------------------------------------------------------
-- 6. Recompute everything once, then the readiness check
-- ---------------------------------------------------------------------------
DO $$
DECLARE b record;
BEGIN
  FOR b IN SELECT id FROM public.businesses LOOP
    PERFORM private.recompute_business_stats(b.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.business_trust_ready() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    public.business_foundation_ready()
    AND (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name IN ('rating_score', 'trust_level')) = 2
    AND (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'business_reviews'
         AND column_name IN ('hidden_at', 'hidden_reason', 'hidden_by', 'admin_cleared')) = 4
    AND to_regclass('public.business_flags') IS NOT NULL
    AND to_regclass('public.review_reports') IS NOT NULL
    AND to_regclass('public.business_appeals') IS NOT NULL
    AND (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname IN (
         'admin_resolve_review_report', 'admin_resolve_flag', 'appeal_decision', 'admin_resolve_appeal', 'business_activity')) = 5
    AND (SELECT count(*) FROM pg_trigger t
       WHERE t.tgrelid = 'public.business_reviews'::regclass AND NOT t.tgisinternal AND t.tgname = 'flag_review') = 1
    AND EXISTS (SELECT 1 FROM public.schema_features WHERE name = 'business_trust')
$$;
GRANT EXECUTE ON FUNCTION public.business_trust_ready() TO anon, authenticated;

INSERT INTO public.schema_features (name, version) VALUES ('business_trust', 1)
ON CONFLICT (name) DO UPDATE SET version = EXCLUDED.version, applied_at = now();
