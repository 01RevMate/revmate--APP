BEGIN;

CREATE TYPE public.account_status AS ENUM ('active', 'banned', 'removed');
CREATE TYPE public.post_report_reason AS ENUM (
  'spam', 'scam', 'sexual_spam', 'harassment', 'hate', 'dangerous', 'off_topic', 'other'
);
CREATE TYPE public.post_report_status AS ENUM ('open', 'dismissed', 'actioned');
CREATE TYPE public.protected_term_match AS ENUM ('word', 'phrase');

ALTER TABLE public.profiles
  ADD COLUMN account_status public.account_status NOT NULL DEFAULT 'active',
  ADD COLUMN moderation_note text,
  ADD COLUMN moderated_at timestamptz,
  ADD COLUMN moderated_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE TABLE public.post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reason public.post_report_reason NOT NULL,
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status public.post_report_status NOT NULL DEFAULT 'open',
  reviewed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (blocker_id <> blocked_id),
  UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE public.protected_post_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL,
  match_type public.protected_term_match NOT NULL DEFAULT 'phrase',
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term, match_type),
  CHECK (char_length(btrim(term)) BETWEEN 2 AND 100)
);

CREATE INDEX post_reports_status_created_idx ON public.post_reports(status, created_at DESC);
CREATE INDEX post_reports_reported_user_idx ON public.post_reports(reported_user_id, created_at DESC);
CREATE INDEX user_blocks_blocker_idx ON public.user_blocks(blocker_id);
CREATE INDEX user_blocks_blocked_idx ON public.user_blocks(blocked_id);
CREATE INDEX profiles_account_status_idx ON public.profiles(account_status);

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE FUNCTION private.is_revmate_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT check_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = check_user_id AND role = 'admin' AND account_status = 'active'
  );
$$;

CREATE FUNCTION private.is_active_account(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT check_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = check_user_id AND account_status = 'active'
  );
$$;

CREATE FUNCTION private.users_are_blocked(first_user uuid, second_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT first_user IS NOT NULL AND second_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE (blocker_id = first_user AND blocked_id = second_user)
       OR (blocker_id = second_user AND blocked_id = first_user)
  );
$$;

CREATE FUNCTION private.viewer_blocked_profile(viewer_id uuid, profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT viewer_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_blocks
    WHERE blocker_id = viewer_id AND blocked_id = profile_id
  );
$$;

CREATE FUNCTION private.can_view_post(check_post_id uuid, viewer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = check_post_id
      AND private.is_active_account(p.user_id)
      AND (
        viewer_id IS NULL
        OR private.is_revmate_admin(viewer_id)
        OR (
          private.is_active_account(viewer_id)
          AND NOT private.users_are_blocked(p.user_id, viewer_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.is_revmate_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_active_account(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.users_are_blocked(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.viewer_blocked_profile(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.can_view_post(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_revmate_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_account(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.users_are_blocked(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.viewer_blocked_profile(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_post(uuid, uuid) TO anon, authenticated;

CREATE FUNCTION private.prepare_post_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.reporter_id IS DISTINCT FROM (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'You can only submit a report as yourself';
  END IF;
  SELECT user_id INTO NEW.reported_user_id FROM public.posts WHERE id = NEW.post_id;
  IF NEW.reported_user_id IS NULL THEN RAISE EXCEPTION 'Post not found'; END IF;
  IF NEW.reported_user_id = NEW.reporter_id THEN RAISE EXCEPTION 'You cannot report your own post'; END IF;
  NEW.status := 'open';
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.protect_report_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- ON DELETE SET NULL preserves the report when its post is removed. This
  -- internal foreign-key update must also work when the author deletes a post.
  IF OLD.post_id IS NOT NULL AND NEW.post_id IS NULL
    AND NEW.reporter_id IS NOT DISTINCT FROM OLD.reporter_id
    AND NEW.reported_user_id IS NOT DISTINCT FROM OLD.reported_user_id
    AND NEW.reason IS NOT DISTINCT FROM OLD.reason
    AND NEW.details IS NOT DISTINCT FROM OLD.details
    AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.reviewed_by IS NOT DISTINCT FROM OLD.reviewed_by
    AND NEW.reviewed_at IS NOT DISTINCT FROM OLD.reviewed_at
    AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
    RETURN NEW;
  END IF;

  IF NOT private.is_revmate_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'Only an admin can review reports';
  END IF;
  IF NEW.post_id IS DISTINCT FROM OLD.post_id
    OR NEW.reporter_id IS DISTINCT FROM OLD.reporter_id
    OR NEW.reported_user_id IS DISTINCT FROM OLD.reported_user_id
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.details IS DISTINCT FROM OLD.details
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Report evidence cannot be changed';
  END IF;
  NEW.reviewed_by := (SELECT auth.uid());
  NEW.reviewed_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.protect_profile_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  changes_access boolean := (
    NEW.role IS DISTINCT FROM OLD.role
    OR NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.moderation_note IS DISTINCT FROM OLD.moderation_note
    OR NEW.moderated_at IS DISTINCT FROM OLD.moderated_at
    OR NEW.moderated_by IS DISTINCT FROM OLD.moderated_by
  );
BEGIN
  IF changes_access AND actor IS NOT NULL AND NOT private.is_revmate_admin(actor) THEN
    RAISE EXCEPTION 'Only an admin can change account access';
  END IF;

  IF actor = OLD.user_id AND (
    (OLD.role = 'admin' AND NEW.role <> 'admin')
    OR (OLD.account_status = 'active' AND NEW.account_status <> 'active')
  ) THEN
    RAISE EXCEPTION 'Admins cannot restrict their own account';
  END IF;

  IF NEW.role = 'admin' AND NEW.account_status <> 'active' THEN
    RAISE EXCEPTION 'Only active accounts can be admins';
  END IF;

  IF OLD.role = 'admin' AND OLD.account_status = 'active'
    AND (NEW.role <> 'admin' OR NEW.account_status <> 'active')
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id <> OLD.user_id AND role = 'admin' AND account_status = 'active'
    ) THEN
    RAISE EXCEPTION 'RevMate must keep at least one active admin';
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.moderation_note IS DISTINCT FROM OLD.moderation_note THEN
    NEW.moderated_at := now();
    NEW.moderated_by := actor;
    IF NEW.account_status <> 'active' THEN NEW.active_garage_car_id := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.enforce_safe_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized text := lower(regexp_replace(NEW.body, '\\s+', ' ', 'g'));
  matched_term text;
BEGIN
  IF NOT private.is_active_account(NEW.user_id) THEN
    RAISE EXCEPTION 'This account cannot publish posts';
  END IF;

  SELECT term INTO matched_term
  FROM public.protected_post_terms
  WHERE active AND (
    (match_type = 'phrase' AND strpos(normalized, lower(btrim(term))) > 0)
    OR (match_type = 'word' AND lower(btrim(term)) = ANY(
      regexp_split_to_array(normalized, '[^a-z0-9]+')
    ))
  )
  LIMIT 1;
  IF matched_term IS NOT NULL THEN
    RAISE EXCEPTION 'Protect Posts blocked this post. Remove the spam phrase and try again.';
  END IF;

  IF TG_OP = 'INSERT' AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE user_id = NEW.user_id
      AND lower(regexp_replace(body, '\\s+', ' ', 'g')) = normalized
      AND created_at > now() - interval '30 minutes'
  ) THEN
    RAISE EXCEPTION 'This looks like a duplicate post';
  END IF;

  IF TG_OP = 'INSERT' AND (
    SELECT count(*) FROM public.posts
    WHERE user_id = NEW.user_id AND created_at > now() - interval '2 minutes'
  ) >= 5 THEN
    RAISE EXCEPTION 'Too many posts in a short time. Please wait before posting again.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.clean_up_blocked_connection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.friendships
  WHERE (requester_id = NEW.blocker_id AND recipient_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND recipient_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.enforce_active_social_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
  IF actor IS NOT NULL AND NOT private.is_active_account(actor) THEN
    RAISE EXCEPTION 'This account has been restricted';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE FUNCTION private.prevent_blocked_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE other_user uuid;
BEGIN
  SELECT CASE WHEN user_a = NEW.sender_id THEN user_b ELSE user_a END INTO other_user
  FROM public.conversations WHERE id = NEW.conversation_id;
  IF private.users_are_blocked(NEW.sender_id, other_user) THEN
    RAISE EXCEPTION 'Messages are unavailable between these accounts';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.prevent_blocked_friendship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.users_are_blocked(NEW.requester_id, NEW.recipient_id) THEN
    RAISE EXCEPTION 'Friend requests are unavailable between these accounts';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION private.prevent_blocked_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.users_are_blocked(NEW.user_a, NEW.user_b) THEN
    RAISE EXCEPTION 'Conversations are unavailable between these accounts';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.prepare_post_report() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.protect_report_review() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.protect_profile_moderation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_safe_post() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.clean_up_blocked_connection() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.enforce_active_social_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_blocked_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_blocked_friendship() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.prevent_blocked_conversation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_role_change ON public.profiles;
CREATE TRIGGER protect_profile_moderation
BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.protect_profile_moderation();
CREATE TRIGGER prepare_post_report
BEFORE INSERT ON public.post_reports FOR EACH ROW EXECUTE FUNCTION private.prepare_post_report();
CREATE TRIGGER protect_report_review
BEFORE UPDATE ON public.post_reports FOR EACH ROW EXECUTE FUNCTION private.protect_report_review();
CREATE TRIGGER enforce_safe_post
BEFORE INSERT OR UPDATE OF body ON public.posts FOR EACH ROW EXECUTE FUNCTION private.enforce_safe_post();
CREATE TRIGGER clean_up_blocked_connection
AFTER INSERT ON public.user_blocks FOR EACH ROW EXECUTE FUNCTION private.clean_up_blocked_connection();
CREATE TRIGGER prevent_blocked_message
BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION private.prevent_blocked_message();
CREATE TRIGGER prevent_blocked_friendship
BEFORE INSERT OR UPDATE ON public.friendships FOR EACH ROW EXECUTE FUNCTION private.prevent_blocked_friendship();
CREATE TRIGGER prevent_blocked_conversation
BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION private.prevent_blocked_conversation();

CREATE TRIGGER active_accounts_only_comments BEFORE INSERT OR UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_likes BEFORE INSERT ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_friendships BEFORE INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_conversations BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_messages BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_questions BEFORE INSERT OR UPDATE ON public.questions
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_answers BEFORE INSERT OR UPDATE ON public.answers
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();
CREATE TRIGGER active_accounts_only_listings BEFORE INSERT OR UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION private.enforce_active_social_actor();

REVOKE ALL ON public.post_reports, public.user_blocks, public.protected_post_terms FROM anon, authenticated;
GRANT SELECT, INSERT ON public.post_reports TO authenticated;
GRANT UPDATE (status) ON public.post_reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.protected_post_terms TO authenticated;
GRANT ALL ON public.post_reports, public.user_blocks, public.protected_post_terms TO service_role;

ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protected_post_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users submit their own reports" ON public.post_reports FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = reporter_id
  AND post_id IS NOT NULL
  AND private.is_active_account((SELECT auth.uid()))
  AND private.can_view_post(post_id, (SELECT auth.uid()))
);
CREATE POLICY "Users view their own reports" ON public.post_reports FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = reporter_id);
CREATE POLICY "Admins view all reports" ON public.post_reports FOR SELECT TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins review reports" ON public.post_reports FOR UPDATE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())))
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

CREATE POLICY "Users view their blocks" ON public.user_blocks FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = blocker_id);
CREATE POLICY "Users block profiles" ON public.user_blocks FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = blocker_id AND private.is_active_account((SELECT auth.uid())));
CREATE POLICY "Users unblock profiles" ON public.user_blocks FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = blocker_id);

CREATE POLICY "Admins view protection terms" ON public.protected_post_terms FOR SELECT TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins add protection terms" ON public.protected_post_terms FOR INSERT TO authenticated
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())) AND created_by = (SELECT auth.uid()));
CREATE POLICY "Admins update protection terms" ON public.protected_post_terms FOR UPDATE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())))
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));
CREATE POLICY "Admins delete protection terms" ON public.protected_post_terms FOR DELETE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Visible profiles are viewable" ON public.profiles FOR SELECT TO anon, authenticated
USING (
  account_status = 'active'
  AND (
    (SELECT auth.uid()) IS NULL
    OR user_id = (SELECT auth.uid())
    OR private.is_revmate_admin((SELECT auth.uid()))
    OR NOT private.users_are_blocked(user_id, (SELECT auth.uid()))
  )
  OR user_id = (SELECT auth.uid())
  OR private.is_revmate_admin((SELECT auth.uid()))
  OR private.viewer_blocked_profile((SELECT auth.uid()), user_id)
);

DROP POLICY "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Visible posts are viewable" ON public.posts FOR SELECT TO anon, authenticated
USING (
  private.is_active_account(user_id)
  AND (
    (SELECT auth.uid()) IS NULL
    OR private.is_revmate_admin((SELECT auth.uid()))
    OR (
      private.is_active_account((SELECT auth.uid()))
      AND NOT private.users_are_blocked(user_id, (SELECT auth.uid()))
    )
  )
  OR private.is_revmate_admin((SELECT auth.uid()))
);
CREATE POLICY "Admins delete any post" ON public.posts FOR DELETE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())));

DROP POLICY "Comments are viewable by everyone" ON public.post_comments;
DROP POLICY "Users comment as themselves" ON public.post_comments;
CREATE POLICY "Visible post comments are viewable" ON public.post_comments FOR SELECT TO anon, authenticated
USING (
  private.is_active_account(user_id)
  AND private.can_view_post(post_id, (SELECT auth.uid()))
);
CREATE POLICY "Active users comment on visible posts" ON public.post_comments FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.is_active_account((SELECT auth.uid()))
  AND private.can_view_post(post_id, (SELECT auth.uid()))
);

DROP POLICY "Likes are viewable by everyone" ON public.post_likes;
DROP POLICY "Users like as themselves" ON public.post_likes;
CREATE POLICY "Visible post likes are viewable" ON public.post_likes FOR SELECT TO anon, authenticated
USING (private.can_view_post(post_id, (SELECT auth.uid())));
CREATE POLICY "Active users like visible posts" ON public.post_likes FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.is_active_account((SELECT auth.uid()))
  AND private.can_view_post(post_id, (SELECT auth.uid()))
);

DROP POLICY "Post images are viewable by everyone" ON public.post_images;
CREATE POLICY "Visible post images are viewable" ON public.post_images FOR SELECT TO anon, authenticated
USING (private.can_view_post(post_id, (SELECT auth.uid())));

CREATE POLICY "Admins update profile access" ON public.profiles FOR UPDATE TO authenticated
USING (private.is_revmate_admin((SELECT auth.uid())))
WITH CHECK (private.is_revmate_admin((SELECT auth.uid())));

INSERT INTO public.protected_post_terms (term, match_type, created_by)
SELECT seed.term, seed.match_type::public.protected_term_match, p.user_id
FROM (VALUES
  ('onlyfans', 'word'),
  ('adult dating', 'phrase'),
  ('escort service', 'phrase'),
  ('telegram me', 'phrase'),
  ('whatsapp me', 'phrase'),
  ('send nudes', 'phrase'),
  ('xxx', 'word')
) AS seed(term, match_type)
CROSS JOIN LATERAL (
  SELECT user_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1
) p
ON CONFLICT DO NOTHING;

COMMIT;
