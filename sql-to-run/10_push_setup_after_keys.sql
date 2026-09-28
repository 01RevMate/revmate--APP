-- STEP 7 (only if you want phone notifications) — run LAST, after:
--   * 09_push_notifications.sql has run
--   * the edge function secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
--     VAPID_SUBJECT and PUSH_WEBHOOK_SECRET are set
--   * the edge function supabase/functions/send-push is deployed
--
-- Replace <PUSH_WEBHOOK_SECRET> below with exactly the same value you set
-- as the PUSH_WEBHOOK_SECRET edge function secret, then run.
--
-- This only tells the database where to send pushes. It is safe to skip —
-- without it, phone notifications stay off and nothing else is affected.

SELECT vault.create_secret(
  'https://gtackixgmvfrxqelrato.supabase.co/functions/v1/send-push',
  'push_function_url'
);

SELECT vault.create_secret(
  '<PUSH_WEBHOOK_SECRET>',
  'push_webhook_secret'
);
