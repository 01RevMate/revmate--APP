-- STEP 6 — Group entry rules and posting rules (same brand / same car
-- gates, entry questions, rules agreement, no-sales setting)
-- Copy of drizzle/migrations/0036_group_rules.sql
-- Run the whole file once, after step 5.

-- Group entry rules and posting rules. Run after 0035_marketplace.sql.
--
-- * entry_rule: 'open' (anyone), 'same_brand' (you need a current car of the
--   group's make in your garage) or 'same_model' (make and model must match).
-- * Posting in a same_brand / same_model group must be done as a matching car
--   from your garage, so nobody can post there as a different car or brand.
-- * allow_sales = false blocks for-sale posts and linked listings.
-- * require_rules_agreement plus group_questions give Facebook-style entry
--   questions: rules to agree to, yes/no questions (optionally with a required
--   answer) and short written answers that moderators see with the request.
-- Group staff (moderators and up) are exempt from the posting rules.
-- Everything is additive — existing groups default to open, sales allowed.

BEGIN;

ALTER TABLE public.community_groups
  ADD COLUMN IF NOT EXISTS entry_rule text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS allow_sales boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_rules_agreement boolean NOT NULL DEFAULT false;

ALTER TABLE public.community_groups DROP CONSTRAINT IF EXISTS community_groups_entry_rule_check;
ALTER TABLE public.community_groups ADD CONSTRAINT community_groups_entry_rule_check CHECK (
  entry_rule IN ('open', 'same_brand', 'same_model')
  AND (entry_rule = 'open' OR make_name IS NOT NULL)
  AND (entry_rule <> 'same_model' OR nullif(btrim(model_name), '') IS NOT NULL)
);

GRANT INSERT (entry_rule, allow_sales, require_rules_agreement) ON public.community_groups TO authenticated;
GRANT UPDATE (entry_rule, allow_sales, require_rules_agreement, make_name, model_name, join_policy)
  ON public.community_groups TO authenticated;

-- ============================================================
-- ENTRY QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.group_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  kind text NOT NULL CHECK (kind IN ('agree', 'yes_no', 'text')),
  prompt text NOT NULL CHECK (char_length(btrim(prompt)) BETWEEN 3 AND 300),
  required_answer text CHECK (required_answer IN ('yes', 'no')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind = 'yes_no' OR required_answer IS NULL)
);
CREATE INDEX IF NOT EXISTS group_questions_group_idx ON public.group_questions(group_id, position);

CREATE OR REPLACE FUNCTION private.limit_group_questions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF (SELECT count(*) FROM public.group_questions WHERE group_id = NEW.group_id) >= 10 THEN
    RAISE EXCEPTION 'A group can have up to 10 entry questions';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS limit_group_questions ON public.group_questions;
CREATE TRIGGER limit_group_questions BEFORE INSERT ON public.group_questions
  FOR EACH ROW EXECUTE FUNCTION private.limit_group_questions();

ALTER TABLE public.group_questions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_questions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.group_questions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.group_questions TO authenticated;
GRANT ALL ON public.group_questions TO service_role;
DROP POLICY IF EXISTS group_questions_read ON public.group_questions;
CREATE POLICY group_questions_read ON public.group_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS group_questions_insert ON public.group_questions;
CREATE POLICY group_questions_insert ON public.group_questions FOR INSERT TO authenticated
  WITH CHECK (private.group_rank(group_id) >= 3);
DROP POLICY IF EXISTS group_questions_update ON public.group_questions;
CREATE POLICY group_questions_update ON public.group_questions FOR UPDATE TO authenticated
  USING (private.group_rank(group_id) >= 3) WITH CHECK (private.group_rank(group_id) >= 3);
DROP POLICY IF EXISTS group_questions_delete ON public.group_questions;
CREATE POLICY group_questions_delete ON public.group_questions FOR DELETE TO authenticated
  USING (private.group_rank(group_id) >= 3);

-- Answers are written only by join_group() and read by the person who
-- answered and the group's moderators.
CREATE TABLE IF NOT EXISTS public.group_join_answers (
  group_id uuid NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  agreed_rules boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE public.group_join_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.group_join_answers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.group_join_answers TO authenticated;
GRANT ALL ON public.group_join_answers TO service_role;
DROP POLICY IF EXISTS group_join_answers_read ON public.group_join_answers;
CREATE POLICY group_join_answers_read ON public.group_join_answers FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR private.group_rank(group_id) >= 2);

-- ============================================================
-- CAR MATCHING
-- ============================================================
CREATE OR REPLACE FUNCTION private.normalise_car_word(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '', 'g')
$$;

-- Does this garage car satisfy the group's brand/model rule?
CREATE OR REPLACE FUNCTION private.car_meets_group_rule(check_car_id uuid, check_group_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.community_groups g
    JOIN public.garage_cars c ON c.id = check_car_id
    WHERE g.id = check_group_id
      AND c.ownership_status = 'current'
      AND (
        g.entry_rule = 'open'
        OR (
          coalesce(private.canonical_vehicle_make(c.make), c.make) IS NOT NULL
          AND private.normalise_car_word(coalesce(private.canonical_vehicle_make(c.make), c.make))
            = private.normalise_car_word(coalesce(private.canonical_vehicle_make(g.make_name), g.make_name))
          AND (
            g.entry_rule = 'same_brand'
            OR private.normalise_car_word(c.model) = private.normalise_car_word(g.model_name)
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.meets_group_entry_rule(gid uuid, uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN (SELECT entry_rule FROM public.community_groups WHERE id = gid) = 'open' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.garage_cars c
      WHERE c.user_id = uid AND private.car_meets_group_rule(c.id, gid)
    )
  END
$$;

CREATE OR REPLACE FUNCTION private.group_rule_label(grp public.community_groups) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE grp.entry_rule
    WHEN 'same_model' THEN grp.make_name || ' ' || grp.model_name
    WHEN 'same_brand' THEN grp.make_name
    ELSE NULL
  END
$$;

-- For the join button: can the signed-in person get in, and if not, why.
CREATE OR REPLACE FUNCTION public.group_entry_eligibility(gid uuid)
RETURNS TABLE (eligible boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  grp public.community_groups;
BEGIN
  SELECT * INTO grp FROM public.community_groups WHERE id = gid;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'Group not found'; RETURN; END IF;
  IF actor IS NULL THEN RETURN QUERY SELECT false, 'Sign in to join'; RETURN; END IF;
  IF private.meets_group_entry_rule(gid, actor) THEN
    RETURN QUERY SELECT true, NULL::text;
  ELSE
    RETURN QUERY SELECT false,
      'This group is for ' || private.group_rule_label(grp) || ' owners. Add your '
      || private.group_rule_label(grp) || ' to your garage to join.';
  END IF;
END; $$;

-- ============================================================
-- JOINING
-- ============================================================
-- answers is a JSON object of question id -> answer ('yes' / 'no' / text).
CREATE OR REPLACE FUNCTION public.join_group(gid uuid, answers jsonb DEFAULT '{}'::jsonb, agreed boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  grp public.community_groups;
  q public.group_questions;
  given text;
  snapshot jsonb := '[]'::jsonb;
  new_status text;
BEGIN
  IF NOT private.is_active_account(actor) THEN RAISE EXCEPTION 'Sign in with an active account'; END IF;
  SELECT * INTO grp FROM public.community_groups WHERE id = gid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.group_members WHERE group_id = gid AND user_id = actor) THEN
    RAISE EXCEPTION 'You already have a membership or request';
  END IF;
  IF NOT private.meets_group_entry_rule(gid, actor) THEN
    RAISE EXCEPTION 'This group is for % owners. Add your % to your garage to join.',
      private.group_rule_label(grp), private.group_rule_label(grp);
  END IF;
  IF grp.require_rules_agreement AND btrim(coalesce(grp.rules, '')) <> '' AND NOT coalesce(agreed, false) THEN
    RAISE EXCEPTION 'Agree to the group rules to join';
  END IF;

  answers := coalesce(answers, '{}'::jsonb);
  IF jsonb_typeof(answers) <> 'object' THEN RAISE EXCEPTION 'Answers must be an object'; END IF;

  FOR q IN SELECT * FROM public.group_questions WHERE group_id = gid ORDER BY position, created_at LOOP
    given := nullif(btrim(answers ->> q.id::text), '');
    IF given IS NULL THEN RAISE EXCEPTION 'Answer every question to join'; END IF;
    IF q.kind = 'agree' AND given <> 'yes' THEN
      RAISE EXCEPTION 'Agree to every rule to join';
    ELSIF q.kind = 'yes_no' THEN
      IF given NOT IN ('yes', 'no') THEN RAISE EXCEPTION 'Answer yes or no'; END IF;
      IF q.required_answer IS NOT NULL AND given <> q.required_answer THEN
        RAISE EXCEPTION 'Your answers don''t meet this group''s entry rules';
      END IF;
    ELSIF q.kind = 'text' AND char_length(given) > 500 THEN
      RAISE EXCEPTION 'Keep answers under 500 characters';
    END IF;
    snapshot := snapshot || jsonb_build_array(jsonb_build_object(
      'question_id', q.id, 'kind', q.kind, 'prompt', q.prompt, 'answer', given));
  END LOOP;

  INSERT INTO public.group_join_answers (group_id, user_id, answers, agreed_rules)
  VALUES (gid, actor, snapshot, coalesce(agreed, false))
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET answers = EXCLUDED.answers, agreed_rules = EXCLUDED.agreed_rules, created_at = now();

  PERFORM set_config('revmate.group_join_checked', gid::text, true);
  PERFORM public.manage_group_member(gid, actor, 'join');
  PERFORM set_config('revmate.group_join_checked', '', true);

  SELECT status INTO new_status FROM public.group_members WHERE group_id = gid AND user_id = actor;
  RETURN new_status;
END; $$;

-- Same as 0015 plus: joining checks the entry rule, and groups with rules to
-- agree to or questions can only be joined through join_group().
CREATE OR REPLACE FUNCTION public.manage_group_member(gid uuid, target_user uuid, action text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := (SELECT auth.uid()); actor_rank integer; target public.group_members; grp public.community_groups;
BEGIN
 IF NOT private.is_active_account(actor) THEN RAISE EXCEPTION 'Sign in with an active account'; END IF;
 SELECT * INTO grp FROM public.community_groups WHERE id=gid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Group not found'; END IF;
 SELECT * INTO target FROM public.group_members WHERE group_id=gid AND user_id=target_user FOR UPDATE;
 actor_rank := private.group_rank(gid);
 IF action='join' THEN
  IF actor<>target_user THEN RAISE EXCEPTION 'Join as yourself'; END IF;
  IF target.id IS NOT NULL THEN RAISE EXCEPTION 'You already have a membership or request'; END IF;
  IF NOT private.meets_group_entry_rule(gid, actor) THEN
   RAISE EXCEPTION 'This group is for % owners. Add your % to your garage to join.',
    private.group_rule_label(grp), private.group_rule_label(grp);
  END IF;
  IF ((grp.require_rules_agreement AND btrim(coalesce(grp.rules, '')) <> '')
       OR EXISTS(SELECT 1 FROM public.group_questions WHERE group_id=gid))
   AND coalesce(current_setting('revmate.group_join_checked', true), '') <> gid::text THEN
   RAISE EXCEPTION 'Answer the group''s entry questions to join';
  END IF;
  INSERT INTO public.group_members(group_id,user_id,status) VALUES(gid,actor,CASE WHEN grp.join_policy='open' THEN 'approved' ELSE 'pending' END);
 ELSIF action='leave' THEN
  IF actor<>target_user OR target.role='owner' OR target.status IN ('banned','rejected') THEN RAISE EXCEPTION 'This membership cannot be removed'; END IF;
  DELETE FROM public.group_members WHERE id=target.id;
 ELSE
  IF target.id IS NULL OR target.role='owner' OR actor=target_user OR actor_rank<2
   OR actor_rank <= (CASE target.role WHEN 'admin' THEN 3 WHEN 'moderator' THEN 2 ELSE 1 END)
   THEN RAISE EXCEPTION 'You cannot manage this member'; END IF;
  IF action IN ('approved','rejected','banned') THEN
   UPDATE public.group_members SET status=action WHERE id=target.id;
  ELSIF action IN ('admin','moderator','member') THEN
   IF actor_rank<4 OR target.status<>'approved' THEN RAISE EXCEPTION 'Only the owner can assign roles to approved members'; END IF;
   UPDATE public.group_members SET role=action WHERE id=target.id;
  ELSE RAISE EXCEPTION 'Unknown membership action'; END IF;
 END IF;
END; $$;

-- ============================================================
-- POSTING RULES
-- ============================================================
CREATE OR REPLACE FUNCTION private.enforce_group_post_rules() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE grp public.community_groups;
BEGIN
  IF NEW.group_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO grp FROM public.community_groups WHERE id = NEW.group_id;
  IF NOT FOUND OR private.group_rank(NEW.group_id) >= 2 THEN RETURN NEW; END IF;

  IF NOT grp.allow_sales AND (NEW.category = 'for_sale' OR NEW.listing_id IS NOT NULL) THEN
    RAISE EXCEPTION 'This group doesn''t allow sales or advertising posts';
  END IF;

  IF grp.entry_rule <> 'open' THEN
    IF NEW.posted_as_garage_car_id IS NULL
       OR NOT private.car_meets_group_rule(NEW.posted_as_garage_car_id, NEW.group_id) THEN
      RAISE EXCEPTION 'Post in this group as your %', private.group_rule_label(grp);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS enforce_group_post_rules ON public.posts;
CREATE TRIGGER enforce_group_post_rules
  BEFORE INSERT OR UPDATE OF group_id, posted_as_garage_car_id, category, listing_id ON public.posts
  FOR EACH ROW EXECUTE FUNCTION private.enforce_group_post_rules();

REVOKE ALL ON FUNCTION private.limit_group_questions(), private.enforce_group_post_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.car_meets_group_rule(uuid, uuid), private.meets_group_entry_rule(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.group_entry_eligibility(uuid), public.join_group(uuid, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_entry_eligibility(uuid), public.join_group(uuid, jsonb, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.manage_group_member(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manage_group_member(uuid, uuid, text) TO authenticated;

COMMIT;
