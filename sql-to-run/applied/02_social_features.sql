-- STEP 2 — Social features pack (meets, comment replies & likes,
-- mentions, video, saved posts, reposts, polls, spotted, verified badges)
-- Copy of drizzle/migrations/0031_social_features.sql
-- Run the WHOLE file, once. Run step 1 first.

-- Social features pack: car meets & events, comment replies and likes,
-- @mention notifications, video posts, saved posts, reposts, polls, the
-- "spotted" feed and verified badges. Every change is additive — no
-- existing rows are deleted or rewritten.
--
-- Run 0032_push_notifications.sql separately afterwards (it needs the
-- pg_net extension and some one-off setup).

-- Must run outside the transaction below: a new enum value can't be added
-- and then used in the same transaction.
ALTER TYPE public.post_category ADD VALUE IF NOT EXISTS 'spotted';

BEGIN;

-- ============================================================
-- NOTIFICATION KINDS
-- ============================================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment', 'like', 'join_request', 'membership', 'friend_request',
    'friend_accepted', 'car_like', 'answer', 'post_review', 'app_update',
    'message', 'car_follow', 'profile_follow',
    'mention', 'comment_reply', 'comment_like', 'meet_rsvp', 'meet_reminder',
    'repost', 'spotted'
  )
);

-- One place for the new notification kinds: skips self-notifications,
-- blocked pairs and inactive accounts, and de-duplicates bursts.
CREATE FUNCTION private.push_notification(
  recipient uuid,
  actor uuid,
  notification_kind text,
  target_post_id uuid DEFAULT NULL,
  target_car_id uuid DEFAULT NULL,
  notification_message text DEFAULT NULL,
  notification_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF recipient IS NULL OR recipient = actor THEN RETURN; END IF;
  IF actor IS NOT NULL AND private.users_are_blocked(recipient, actor) THEN RETURN; END IF;
  IF NOT private.is_active_account(recipient) THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = recipient
      AND n.actor_id IS NOT DISTINCT FROM actor
      AND n.kind = notification_kind
      AND n.post_id IS NOT DISTINCT FROM target_post_id
      AND n.action_url IS NOT DISTINCT FROM notification_url
      AND n.created_at > now() - interval '1 minute'
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.notifications(
    user_id, actor_id, kind, post_id, garage_car_id, message, action_url
  ) VALUES (
    recipient, actor, notification_kind, target_post_id, target_car_id,
    left(notification_message, 500), notification_url
  );
END;
$$;
REVOKE ALL ON FUNCTION private.push_notification(uuid, uuid, text, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- ============================================================
-- VERIFIED BADGES (club / trader / creator), admin-controlled
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_type text
  CHECK (verified_type IN ('club', 'trader', 'creator'));

CREATE FUNCTION private.protect_profile_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor uuid := (SELECT auth.uid());
BEGIN
  IF NEW.verified_type IS DISTINCT FROM OLD.verified_type
    AND actor IS NOT NULL
    AND NOT private.is_revmate_admin(actor) THEN
    RAISE EXCEPTION 'Only an admin can change verified badges';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_profile_verification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_profile_verification
BEFORE UPDATE OF verified_type ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.protect_profile_verification();

-- ============================================================
-- CAR MEETS & EVENTS
-- ============================================================
CREATE TABLE public.car_meets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz CHECK (ends_at IS NULL OR ends_at > starts_at),
  location_name text NOT NULL CHECK (char_length(btrim(location_name)) BETWEEN 2 AND 200),
  address text CHECK (address IS NULL OR char_length(address) <= 300),
  cover_url text,
  going_count int NOT NULL DEFAULT 0,
  interested_count int NOT NULL DEFAULT 0,
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX car_meets_starts_at_idx ON public.car_meets(starts_at);
CREATE INDEX car_meets_organizer_idx ON public.car_meets(organizer_id);
GRANT SELECT ON public.car_meets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.car_meets TO authenticated;
GRANT ALL ON public.car_meets TO service_role;
ALTER TABLE public.car_meets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meets from active organizers are viewable"
ON public.car_meets FOR SELECT TO anon, authenticated
USING (
  private.is_active_account(organizer_id)
  AND NOT private.users_are_blocked(organizer_id, (SELECT auth.uid()))
  OR private.is_revmate_admin((SELECT auth.uid()))
);
CREATE POLICY "Active users organise meets as themselves"
ON public.car_meets FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = organizer_id
  AND private.is_active_account((SELECT auth.uid()))
);
CREATE POLICY "Organisers update their meets"
ON public.car_meets FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = organizer_id)
WITH CHECK ((SELECT auth.uid()) = organizer_id);
CREATE POLICY "Organisers and admins delete meets"
ON public.car_meets FOR DELETE TO authenticated
USING (
  (SELECT auth.uid()) = organizer_id
  OR private.is_revmate_admin((SELECT auth.uid()))
);

-- Counters and the reminder marker are maintained by the database only.
CREATE FUNCTION private.protect_car_meet_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('revmate.meet_counter_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.going_count := OLD.going_count;
  NEW.interested_count := OLD.interested_count;
  NEW.reminder_sent_at := OLD.reminder_sent_at;
  NEW.organizer_id := OLD.organizer_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_car_meet_counters() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_car_meet_counters
BEFORE UPDATE ON public.car_meets
FOR EACH ROW EXECUTE FUNCTION private.protect_car_meet_counters();

CREATE TABLE public.meet_attendees (
  meet_id uuid NOT NULL REFERENCES public.car_meets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going', 'interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meet_id, user_id)
);
CREATE INDEX meet_attendees_user_idx ON public.meet_attendees(user_id);
GRANT SELECT ON public.meet_attendees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meet_attendees TO authenticated;
GRANT ALL ON public.meet_attendees TO service_role;
ALTER TABLE public.meet_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meet attendance is viewable"
ON public.meet_attendees FOR SELECT TO anon, authenticated
USING (private.is_active_account(user_id));
CREATE POLICY "Active users RSVP as themselves"
ON public.meet_attendees FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.is_active_account((SELECT auth.uid()))
);
CREATE POLICY "Users change their own RSVP"
ON public.meet_attendees FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users remove their own RSVP"
ON public.meet_attendees FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE FUNCTION private.handle_meet_attendee_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  meet public.car_meets%ROWTYPE;
BEGIN
  PERFORM set_config('revmate.meet_counter_update', 'on', true);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.car_meets SET
      going_count = GREATEST(going_count - (OLD.status = 'going')::int, 0),
      interested_count = GREATEST(interested_count - (OLD.status = 'interested')::int, 0)
    WHERE id = OLD.meet_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.car_meets SET
      going_count = going_count + (NEW.status = 'going')::int,
      interested_count = interested_count + (NEW.status = 'interested')::int
    WHERE id = NEW.meet_id;
  END IF;
  PERFORM set_config('revmate.meet_counter_update', 'off', true);

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'going'
    AND (TG_OP = 'INSERT' OR OLD.status <> 'going') THEN
    SELECT * INTO meet FROM public.car_meets WHERE id = NEW.meet_id;
    PERFORM private.push_notification(
      meet.organizer_id, NEW.user_id, 'meet_rsvp', NULL, NULL,
      'is going to ' || meet.title, '/meets/' || meet.id::text
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.handle_meet_attendee_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_meet_attendee_change
AFTER INSERT OR UPDATE OF status OR DELETE ON public.meet_attendees
FOR EACH ROW EXECUTE FUNCTION private.handle_meet_attendee_change();

-- Sends a one-off "starts tomorrow" reminder to everyone going or
-- interested for meets starting in the next 24 hours. Safe to call as often
-- as you like (the app calls it when people open it) — each meet is only
-- ever reminded once.
CREATE FUNCTION public.send_due_meet_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  due record;
  sent integer := 0;
BEGIN
  PERFORM set_config('revmate.meet_counter_update', 'on', true);
  FOR due IN
    UPDATE public.car_meets
    SET reminder_sent_at = now()
    WHERE reminder_sent_at IS NULL
      AND cancelled_at IS NULL
      AND starts_at > now()
      AND starts_at <= now() + interval '24 hours'
    RETURNING id, title, organizer_id
  LOOP
    INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
    SELECT a.user_id, due.organizer_id, 'meet_reminder',
      left(due.title || ' is coming up soon', 500), '/meets/' || due.id::text
    FROM public.meet_attendees a
    WHERE a.meet_id = due.id
      AND private.is_active_account(a.user_id);
    sent := sent + 1;
  END LOOP;
  PERFORM set_config('revmate.meet_counter_update', 'off', true);
  RETURN sent;
END;
$$;
REVOKE ALL ON FUNCTION public.send_due_meet_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_due_meet_reminders() TO authenticated;

-- ============================================================
-- COMMENT REPLIES & COMMENT LIKES
-- ============================================================
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS likes_count int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx ON public.post_comments(parent_id);

-- Replies stay one level deep (a reply to a reply attaches to the same
-- top-level comment) and must belong to the same post.
CREATE FUNCTION private.normalize_comment_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  parent public.post_comments%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM public.post_comments WHERE id = NEW.parent_id;
  IF NOT FOUND OR parent.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'You can only reply to a comment on the same post';
  END IF;
  IF parent.parent_id IS NOT NULL THEN
    NEW.parent_id := parent.parent_id;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.likes_count := 0; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.normalize_comment_parent() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER normalize_comment_parent
BEFORE INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION private.normalize_comment_parent();

CREATE FUNCTION private.notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_author uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO parent_author FROM public.post_comments WHERE id = NEW.parent_id;
  PERFORM private.push_notification(
    parent_author, NEW.user_id, 'comment_reply', NEW.post_id, NULL,
    left(NEW.body, 140), '/posts/' || NEW.post_id::text
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_comment_reply() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_comment_reply
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION private.notify_comment_reply();

CREATE TABLE public.comment_likes (
  comment_id uuid NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX comment_likes_user_idx ON public.comment_likes(user_id);
GRANT SELECT ON public.comment_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.comment_likes TO authenticated;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes are viewable"
ON public.comment_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Active users like comments as themselves"
ON public.comment_likes FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.is_active_account((SELECT auth.uid()))
);
CREATE POLICY "Users remove their own comment like"
ON public.comment_likes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE FUNCTION private.handle_comment_like_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE target public.post_comments%ROWTYPE;
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  IF TG_OP = 'INSERT' THEN
    UPDATE public.post_comments SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id
    RETURNING * INTO target;
    PERFORM private.push_notification(
      target.user_id, NEW.user_id, 'comment_like', target.post_id, NULL,
      left(target.body, 140), '/posts/' || target.post_id::text
    );
    PERFORM set_config('revmate.counter_update', 'off', true);
    RETURN NEW;
  END IF;
  UPDATE public.post_comments SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = OLD.comment_id;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_comment_like_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_comment_like_change
AFTER INSERT OR DELETE ON public.comment_likes
FOR EACH ROW EXECUTE FUNCTION private.handle_comment_like_change();

-- ============================================================
-- @MENTIONS (posts and comments)
-- ============================================================
CREATE FUNCTION private.notify_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mentioned uuid;
  target_post uuid;
BEGIN
  -- Separate branches: plpgsql can't even reference NEW.post_id on a posts row.
  IF TG_TABLE_NAME = 'posts' THEN
    target_post := NEW.id;
  ELSE
    target_post := NEW.post_id;
  END IF;
  FOR mentioned IN
    SELECT DISTINCT p.user_id
    FROM (
      SELECT lower(m[1]) AS handle
      FROM regexp_matches(NEW.body, '(?:^|[^A-Za-z0-9_])@([A-Za-z0-9_.]{2,30})', 'g') AS m
      LIMIT 10
    ) handles
    JOIN public.profiles p
      ON lower(regexp_replace(p.username, '^@+', '')) = handles.handle
  LOOP
    PERFORM private.push_notification(
      mentioned, NEW.user_id, 'mention', target_post, NULL,
      left(NEW.body, 140), '/posts/' || target_post::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.notify_mentions() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_post_mentions
AFTER INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.notify_mentions();
CREATE TRIGGER notify_comment_mentions
AFTER INSERT ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION private.notify_mentions();

-- ============================================================
-- VIDEO POSTS — videos share the post-images bucket and post_images table
-- ============================================================
UPDATE storage.buckets
SET
  file_size_limit = 52428800, -- 50MB (images are still capped at 5MB in the app)
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
WHERE id = 'post-images';

-- ============================================================
-- SAVED POSTS
-- ============================================================
CREATE TABLE public.saved_posts (
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX saved_posts_user_created_idx ON public.saved_posts(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.saved_posts TO authenticated;
GRANT ALL ON public.saved_posts TO service_role;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own saved posts"
ON public.saved_posts FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users save posts they can see"
ON public.saved_posts FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.can_view_post(post_id, (SELECT auth.uid()))
);
CREATE POLICY "Users unsave their own posts"
ON public.saved_posts FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- REPOSTS & SPOTTED
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS repost_of_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reposts_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spotted_garage_car_id uuid REFERENCES public.garage_cars(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS posts_one_repost_per_user_idx
  ON public.posts(user_id, repost_of_id) WHERE repost_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS posts_spotted_garage_car_idx
  ON public.posts(spotted_garage_car_id) WHERE spotted_garage_car_id IS NOT NULL;

CREATE FUNCTION private.validate_repost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE original public.posts%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.reposts_count := 0; END IF;
  IF NEW.repost_of_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO original FROM public.posts WHERE id = NEW.repost_of_id;
  IF NOT FOUND OR NOT private.can_view_post(original.id, NEW.user_id) THEN
    RAISE EXCEPTION 'That post can no longer be reposted';
  END IF;
  -- Always point at the original, never a repost of a repost.
  IF original.repost_of_id IS NOT NULL THEN
    NEW.repost_of_id := original.repost_of_id;
  END IF;
  IF original.user_id = NEW.user_id AND original.repost_of_id IS NULL THEN
    RAISE EXCEPTION 'You cannot repost your own post';
  END IF;
  IF original.group_id IS NOT NULL OR original.audience <> 'public' THEN
    RAISE EXCEPTION 'Only public posts can be reposted';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_repost() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_repost
BEFORE INSERT ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.validate_repost();

CREATE FUNCTION private.handle_repost_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE original_author uuid;
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  IF TG_OP = 'INSERT' THEN
    IF NEW.repost_of_id IS NOT NULL THEN
      UPDATE public.posts SET reposts_count = reposts_count + 1
      WHERE id = NEW.repost_of_id
      RETURNING user_id INTO original_author;
      PERFORM private.push_notification(
        original_author, NEW.user_id, 'repost', NEW.repost_of_id, NULL,
        NULL, '/posts/' || NEW.id::text
      );
    END IF;
    IF NEW.spotted_garage_car_id IS NOT NULL THEN
      PERFORM private.push_notification(
        (SELECT g.user_id FROM public.garage_cars g WHERE g.id = NEW.spotted_garage_car_id),
        NEW.user_id, 'spotted', NEW.id, NEW.spotted_garage_car_id,
        NULL, '/posts/' || NEW.id::text
      );
    END IF;
    PERFORM set_config('revmate.counter_update', 'off', true);
    RETURN NEW;
  END IF;
  IF OLD.repost_of_id IS NOT NULL THEN
    UPDATE public.posts SET reposts_count = GREATEST(reposts_count - 1, 0)
    WHERE id = OLD.repost_of_id;
  END IF;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.handle_repost_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_repost_change
AFTER INSERT OR DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.handle_repost_change();

-- Same as before, except reposts skip the duplicate-text check (several
-- reposts can all have an empty caption) and posts with a poll or video
-- may have short captions.
CREATE OR REPLACE FUNCTION private.enforce_safe_post()
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

  IF TG_OP = 'INSERT' AND NEW.repost_of_id IS NULL AND btrim(NEW.body) <> '' AND EXISTS (
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

-- ============================================================
-- COUNTER PROTECTION — like/repost counts and links can only be changed
-- by the database's own triggers, not by editing your own comment or post.
-- ============================================================
CREATE FUNCTION private.protect_social_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('revmate.counter_update', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'post_comments' THEN
    NEW.likes_count := OLD.likes_count;
    NEW.parent_id := OLD.parent_id;
  ELSIF TG_TABLE_NAME = 'posts' THEN
    NEW.reposts_count := OLD.reposts_count;
    NEW.repost_of_id := OLD.repost_of_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.protect_social_counters() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_comment_counters
BEFORE UPDATE ON public.post_comments
FOR EACH ROW EXECUTE FUNCTION private.protect_social_counters();
CREATE TRIGGER protect_post_repost_counters
BEFORE UPDATE ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.protect_social_counters();

-- ============================================================
-- POLLS
-- ============================================================
CREATE TABLE public.post_poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position BETWEEN 0 AND 3),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  image_url text,
  votes_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, position)
);
GRANT SELECT ON public.post_poll_options TO anon;
GRANT SELECT, INSERT ON public.post_poll_options TO authenticated;
GRANT ALL ON public.post_poll_options TO service_role;
ALTER TABLE public.post_poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Poll options on visible posts are viewable"
ON public.post_poll_options FOR SELECT TO anon, authenticated
USING (private.can_view_post(post_id, (SELECT auth.uid())));
CREATE POLICY "Post authors add poll options"
ON public.post_poll_options FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_id AND p.user_id = (SELECT auth.uid())
  )
  AND votes_count = 0
);

CREATE TABLE public.post_poll_votes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.post_poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_votes TO authenticated;
GRANT ALL ON public.post_poll_votes TO service_role;
ALTER TABLE public.post_poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own poll votes"
ON public.post_poll_votes FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Active users vote as themselves"
ON public.post_poll_votes FOR INSERT TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND private.is_active_account((SELECT auth.uid()))
  AND private.can_view_post(post_id, (SELECT auth.uid()))
  AND EXISTS (
    SELECT 1 FROM public.post_poll_options o
    WHERE o.id = option_id AND o.post_id = post_poll_votes.post_id
  )
);
CREATE POLICY "Users change their own poll vote"
ON public.post_poll_votes FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.post_poll_options o
    WHERE o.id = option_id AND o.post_id = post_poll_votes.post_id
  )
);
CREATE POLICY "Users remove their own poll vote"
ON public.post_poll_votes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Lets the app skip the poll lookup for the (many) posts without one.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS has_poll boolean NOT NULL DEFAULT false;

CREATE FUNCTION private.mark_post_has_poll()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.posts SET has_poll = true WHERE id = NEW.post_id AND NOT has_poll;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.mark_post_has_poll() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mark_post_has_poll
AFTER INSERT ON public.post_poll_options
FOR EACH ROW EXECUTE FUNCTION private.mark_post_has_poll();

CREATE FUNCTION private.handle_poll_vote_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('revmate.counter_update', 'on', true);
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    UPDATE public.post_poll_options SET votes_count = GREATEST(votes_count - 1, 0)
    WHERE id = OLD.option_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.post_poll_options SET votes_count = votes_count + 1
    WHERE id = NEW.option_id;
  END IF;
  PERFORM set_config('revmate.counter_update', 'off', true);
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION private.handle_poll_vote_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_poll_vote_change
AFTER INSERT OR UPDATE OF option_id OR DELETE ON public.post_poll_votes
FOR EACH ROW EXECUTE FUNCTION private.handle_poll_vote_change();

COMMIT;
