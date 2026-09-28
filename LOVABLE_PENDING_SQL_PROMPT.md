# Lovable prompts — run outstanding RevMate SQL

Steps 1–12 in `sql-to-run/` have all been applied (the latest, 8–12, on 28
September 2026) and their files are kept in `sql-to-run/applied/`. The only
things left are the quick live-messages step and the optional phone
notifications setup below.

---

## Prompt 0 — live unread-message badge (recommended)

```
Please run sql-to-run/15_live_messages.sql on the connected Supabase
database, exactly as committed. It adds public.messages to the
supabase_realtime publication (only if it isn't already there) and creates
the index messages_unread_idx. It doesn't change any data. Then confirm
messages is listed in pg_publication_tables for supabase_realtime.
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
`PENDING_SQL.md` (or ask Claude/Lovable to do it).

---

When something has run, move it to the "Applied" section of
`PENDING_SQL.md` and its file into `sql-to-run/applied/` (or ask
Claude/Lovable to do it).
