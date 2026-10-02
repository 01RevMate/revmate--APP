# Lovable prompts — run outstanding RevMate SQL

Steps 1–12 in `sql-to-run/` have all been applied (the latest, 8–12, on 28
September 2026). Steps 15 (live unread badge), 16 (Speakers / Sound
diagnostics), 17 (Buy & Sell upgrade) and 18 (group covers + more social
links) were applied on 1 October 2026. Left to do: only the optional phone
notifications setup.

---

## ⭐ Prompt A — public profile pages

```
Please run sql-to-run/19_public_profiles.sql on the connected Supabase
database, exactly as committed (a copy of
drizzle/migrations/0055_public_profiles.sql, safe to re-run). It adds the
functions public.public_profile(text) and public.public_profile_handles(int)
(granted to anon and authenticated) and an index on profiles. It doesn't
change any data. Then regenerate the Supabase TypeScript types and confirm
the app builds.
```

---

## Prompt 1 — phone push notifications (optional)

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/13_push_notifications.sql on the connected Supabase
   database, exactly as committed (it enables the pg_net extension and adds
   a push_subscriptions table and a trigger on notifications).
2. Generate a VAPID key pair for web push.
3. Add these edge function secrets:
   - VAPID_PUBLIC_KEY  = the generated public key
   - VAPID_PRIVATE_KEY = the generated private key
   - VAPID_SUBJECT     = mailto:<my email address>
   - PUSH_WEBHOOK_SECRET = a new long random string
4. Deploy (or redeploy) the edge function in supabase/functions/send-push
   (it must allow calls without a user JWT — supabase/config.toml already
   sets verify_jwt = false for it).
5. Run sql-to-run/14_push_setup_after_keys.sql, replacing
   <PUSH_WEBHOOK_SECRET> with the same value used in step 3.

Then confirm the send-push function returns a publicKey on a GET request.
```

---

When something has run, move it to the "Applied" section of
`PENDING_SQL.md` and its file into `sql-to-run/applied/` (or ask
Claude/Lovable to do it).
