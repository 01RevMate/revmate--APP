-- Run after 20260922223000_complete_in_app_notifications.sql.
-- Adds private message photos, secure seen receipts and message notifications.
BEGIN;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_body_or_image_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_body_or_image_check
  CHECK (
    (char_length(btrim(body)) BETWEEN 1 AND 5000)
    OR image_path IS NOT NULL
  ) NOT VALID;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-images',
  'message-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS message_image_read ON storage.objects;
CREATE POLICY message_image_read
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-images'
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
  )
);

DROP POLICY IF EXISTS message_image_upload ON storage.objects;
CREATE POLICY message_image_upload
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id::text = (storage.foldername(name))[2]
      AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
  )
);

DROP POLICY IF EXISTS message_image_delete ON storage.objects;
CREATE POLICY message_image_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'message-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE OR REPLACE FUNCTION private.validate_message_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF char_length(NEW.body) > 5000 THEN
    RAISE EXCEPTION 'Messages can be up to 5000 characters';
  END IF;

  IF btrim(NEW.body) = '' AND NEW.image_path IS NULL THEN
    RAISE EXCEPTION 'Write a message or attach a photo';
  END IF;

  IF NEW.image_path IS NOT NULL AND (
    split_part(NEW.image_path, '/', 1) <> NEW.sender_id::text
    OR split_part(NEW.image_path, '/', 2) <> NEW.conversation_id::text
    OR split_part(NEW.image_path, '/', 3) = ''
  ) THEN
    RAISE EXCEPTION 'That message photo is not valid for this conversation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_message_content ON public.messages;
CREATE TRIGGER validate_message_content
BEFORE INSERT OR UPDATE OF body, image_path, conversation_id, sender_id
ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.validate_message_content();

DROP POLICY IF EXISTS "Recipient marks messages read" ON public.messages;
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE(read_at) ON public.messages TO authenticated;

CREATE POLICY "Recipient marks messages read"
ON public.messages FOR UPDATE TO authenticated
USING (
  sender_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
  )
)
WITH CHECK (
  sender_id <> (SELECT auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = conversation_id
      AND ((SELECT auth.uid()) = c.user_a OR (SELECT auth.uid()) = c.user_b)
  )
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
    'app_update',
    'message'
  )
);

CREATE OR REPLACE FUNCTION private.notify_message_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient uuid;
  sender_username text;
  notification_message text;
BEGIN
  SELECT
    CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
  INTO recipient
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id
    AND NEW.sender_id IN (c.user_a, c.user_b);

  IF recipient IS NULL OR private.users_are_blocked(recipient, NEW.sender_id) THEN
    RETURN NEW;
  END IF;

  SELECT p.username INTO sender_username
  FROM public.profiles p
  WHERE p.user_id = NEW.sender_id;

  notification_message := CASE
    WHEN NEW.image_path IS NOT NULL AND btrim(NEW.body) = '' THEN 'sent you a photo'
    ELSE 'sent you a message'
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = recipient
      AND n.actor_id = NEW.sender_id
      AND n.kind = 'message'
      AND n.created_at > now() - interval '1 minute'
  ) THEN
    INSERT INTO public.notifications(user_id, actor_id, kind, message, action_url)
    VALUES (
      recipient,
      NEW.sender_id,
      'message',
      notification_message,
      '/messages/' || sender_username
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_message ON public.messages;
CREATE TRIGGER notify_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION private.notify_message_activity();

REVOKE ALL ON FUNCTION private.validate_message_content() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.notify_message_activity() FROM PUBLIC, anon, authenticated;

COMMIT;
