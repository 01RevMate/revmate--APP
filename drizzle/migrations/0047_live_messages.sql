-- Live unread-message badge.
-- 1. Lets the app hear about new and read messages instantly (Supabase
--    Realtime), so the red count on Messages updates without waiting.
-- 2. A small index so counting unread messages stays fast.
-- Safe to run more than once. Nothing is deleted or changed.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS messages_unread_idx
  ON public.messages (conversation_id, sender_id)
  WHERE read_at IS NULL;
