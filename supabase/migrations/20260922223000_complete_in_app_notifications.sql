BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN garage_car_id uuid REFERENCES public.garage_cars(id) ON DELETE CASCADE,
  ADD COLUMN question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  ADD COLUMN message text CHECK (message IS NULL OR char_length(message) <= 500),
  ADD COLUMN action_url text CHECK (
    action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%')
  );

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind IN (
    'comment',
    'like',
    'join_request',
    'membership',
    'friend_request',
    'friend_accepted',
    'car_like',
    'answer',
    'post_review',
    'app_update'
  )
);

CREATE INDEX notifications_user_unread_created_idx
  ON public.notifications(user_id, created_at DESC)
  WHERE read_at IS NULL;

UPDATE public.notifications
SET action_url = '/posts/' || post_id::text
WHERE post_id IS NOT NULL AND action_url IS NULL;

UPDATE public.notifications n
SET action_url = '/groups/' || g.slug
FROM public.community_groups g
WHERE n.group_id = g.id AND n.action_url IS NULL;

CREATE OR REPLACE FUNCTION private.notify_social_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient uuid;
  actor uuid;
  notification_kind text;
  notification_message text;
  notification_url text;
  target_group_id uuid;
  target_post_id uuid;
  target_car_id uuid;
  target_question_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'post_likes' OR TG_TABLE_NAME = 'post_comments' THEN
    SELECT p.user_id INTO recipient FROM public.posts p WHERE p.id = NEW.post_id;
    actor := NEW.user_id;
    notification_kind := CASE WHEN TG_TABLE_NAME = 'post_likes' THEN 'like' ELSE 'comment' END;
    target_post_id := NEW.post_id;
    notification_url := '/posts/' || NEW.post_id::text;

  ELSIF TG_TABLE_NAME = 'friendships' THEN
    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      recipient := NEW.recipient_id;
      actor := NEW.requester_id;
      notification_kind := 'friend_request';
      SELECT '/u/' || p.username INTO notification_url
      FROM public.profiles p WHERE p.user_id = NEW.requester_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
      recipient := NEW.requester_id;
      actor := NEW.recipient_id;
      notification_kind := 'friend_accepted';
      SELECT '/u/' || p.username INTO notification_url
      FROM public.profiles p WHERE p.user_id = NEW.recipient_id;
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'garage_car_likes' THEN
    SELECT g.user_id INTO recipient FROM public.garage_cars g WHERE g.id = NEW.garage_car_id;
    actor := NEW.user_id;
    notification_kind := 'car_like';
    target_car_id := NEW.garage_car_id;
    notification_url := '/garage';

  ELSIF TG_TABLE_NAME = 'answers' THEN
    SELECT q.user_id,
      '/cars/' || c.make_slug || '/' || c.model_slug || '/' || c.generation_slug ||
        '#question-' || q.id::text,
      q.id
    INTO recipient, notification_url, target_question_id
    FROM public.questions q
    JOIN public.cars c ON c.id = q.car_id
    WHERE q.id = NEW.question_id;
    actor := NEW.user_id;
    notification_kind := 'answer';

  ELSIF TG_TABLE_NAME = 'group_members' THEN
    target_group_id := NEW.group_id;
    SELECT '/groups/' || g.slug INTO notification_url
    FROM public.community_groups g WHERE g.id = NEW.group_id;

    IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
      INSERT INTO public.notifications(
        user_id, actor_id, kind, group_id, message, action_url
      )
      SELECT gm.user_id, NEW.user_id, 'join_request', NEW.group_id,
        'requested to join', notification_url
      FROM public.group_members gm
      WHERE gm.group_id = NEW.group_id
        AND gm.status = 'approved'
        AND gm.role IN ('owner', 'admin', 'moderator')
        AND gm.user_id <> NEW.user_id;
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
      recipient := NEW.user_id;
      actor := (SELECT auth.uid());
      notification_kind := 'membership';
      notification_message := CASE NEW.status
        WHEN 'approved' THEN 'approved your request to join'
        WHEN 'rejected' THEN 'declined your request to join'
        WHEN 'banned' THEN 'removed you from'
        ELSE 'updated your membership in'
      END;
    ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
      recipient := NEW.user_id;
      actor := (SELECT auth.uid());
      notification_kind := 'membership';
      notification_message := 'made you a ' || NEW.role || ' in';
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'posts' THEN
    IF TG_OP <> 'UPDATE' OR NEW.moderation_status IS NOT DISTINCT FROM OLD.moderation_status THEN
      RETURN NEW;
    END IF;
    recipient := NEW.user_id;
    actor := (SELECT auth.uid());
    notification_kind := 'post_review';
    notification_message := CASE NEW.moderation_status
      WHEN 'published' THEN 'approved your post in'
      WHEN 'rejected' THEN 'did not approve your post in'
      ELSE 'updated your post in'
    END;
    target_group_id := NEW.group_id;
    target_post_id := NEW.id;
    SELECT '/groups/' || g.slug INTO notification_url
    FROM public.community_groups g WHERE g.id = NEW.group_id;

  ELSE
    RETURN NEW;
  END IF;

  IF recipient IS NULL OR actor IS NULL OR recipient = actor THEN
    RETURN NEW;
  END IF;

  IF private.users_are_blocked(recipient, actor) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = recipient
      AND n.actor_id = actor
      AND n.kind = notification_kind
      AND n.post_id IS NOT DISTINCT FROM target_post_id
      AND n.group_id IS NOT DISTINCT FROM target_group_id
      AND n.garage_car_id IS NOT DISTINCT FROM target_car_id
      AND n.question_id IS NOT DISTINCT FROM target_question_id
      AND n.created_at > now() - interval '1 minute'
  ) THEN
    INSERT INTO public.notifications(
      user_id,
      actor_id,
      kind,
      post_id,
      group_id,
      garage_car_id,
      question_id,
      message,
      action_url
    ) VALUES (
      recipient,
      actor,
      notification_kind,
      target_post_id,
      target_group_id,
      target_car_id,
      target_question_id,
      notification_message,
      notification_url
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_friendship
AFTER INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();

CREATE TRIGGER notify_garage_car_like
AFTER INSERT ON public.garage_car_likes
FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();

CREATE TRIGGER notify_answer
AFTER INSERT ON public.answers
FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();

CREATE TRIGGER notify_group_post_review
AFTER UPDATE OF moderation_status ON public.posts
FOR EACH ROW EXECUTE FUNCTION private.notify_social_activity();

CREATE FUNCTION public.send_app_update(update_message text, update_url text DEFAULT '/')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor uuid := (SELECT auth.uid());
  inserted_count integer;
BEGIN
  IF NOT private.is_active_account(actor) OR NOT private.is_revmate_admin(actor) THEN
    RAISE EXCEPTION 'Only active RevMate admins can send app updates';
  END IF;
  update_message := btrim(update_message);
  update_url := coalesce(nullif(btrim(update_url), ''), '/');
  IF char_length(update_message) < 4 OR char_length(update_message) > 500 THEN
    RAISE EXCEPTION 'Update message must be between 4 and 500 characters';
  END IF;
  IF update_url NOT LIKE '/%' OR update_url LIKE '//%' THEN
    RAISE EXCEPTION 'Update link must be an internal RevMate path';
  END IF;

  INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
  SELECT p.user_id, actor, 'app_update', update_message, update_url
  FROM public.profiles p
  WHERE p.account_status = 'active' AND p.user_id <> actor;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_app_update(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_app_update(text, text) TO authenticated;
REVOKE ALL ON FUNCTION private.notify_social_activity() FROM PUBLIC, anon, authenticated;

COMMIT;
