-- STEP 5 — Phone push notifications (optional)
-- Copy of drizzle/migrations/0032_push_notifications.sql
-- Run after step 2. Then do the setup in 06_push_setup_after_keys.sql.

-- Phone push notifications. Run after 0031_social_features.sql.
--
-- Stores each device's Web Push subscription, and whenever a row lands in
-- public.notifications, asks the "send-push" edge function to deliver it to
-- that user's devices. Sending only starts once two Vault secrets exist
-- (see PENDING_SQL.md); until then this is inert and notifications keep
-- working in the app exactly as before.

CREATE EXTENSION IF NOT EXISTS pg_net;

BEGIN;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%'),
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users register their own devices"
ON public.push_subscriptions FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users update their own devices"
ON public.push_subscriptions FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users remove their own devices"
ON public.push_subscriptions FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Fire-and-forget: pg_net queues the HTTP call and returns immediately, and
-- any failure is swallowed so a push problem can never block a notification.
CREATE FUNCTION private.dispatch_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  function_url text;
  webhook_secret text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO function_url
    FROM vault.decrypted_secrets WHERE name = 'push_function_url';
    SELECT decrypted_secret INTO webhook_secret
    FROM vault.decrypted_secrets WHERE name = 'push_webhook_secret';
    IF function_url IS NULL OR webhook_secret IS NULL THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.user_id) THEN
      RETURN NEW;
    END IF;
    PERFORM net.http_post(
      url := function_url,
      body := jsonb_build_object('notification_id', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', webhook_secret
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.dispatch_push_notification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER dispatch_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION private.dispatch_push_notification();

COMMIT;
