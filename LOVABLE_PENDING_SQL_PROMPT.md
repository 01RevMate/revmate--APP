# Lovable prompts — run outstanding RevMate SQL

Steps 1–7 in `sql-to-run/` have been applied (the last batch on 28 September
2026) and their files are kept in `sql-to-run/applied/`. This is the new
pack. Copy a prompt below (everything inside the box) and paste it into
Lovable.

---

## Prompt 1 — pop-up announcements (do this one)

```
Please run sql-to-run/08_announcements.sql from the repo on the connected
Supabase database, exactly as committed. Don't rewrite, merge or simplify it,
and don't recreate its functions in your own words — use the file as it is.
Stop and tell me if it fails.

It adds public.announcements and public.announcement_views (row level
security on: only admins can create or edit announcements; members only see
live ones meant for them and only their own views), a trigger that stamps
who created each announcement, and the admin-only function
announcement_stats. No existing data is changed.

When it has finished, please confirm:
- public.announcements and public.announcement_views exist with row level
  security enabled
- the function announcement_stats exists

Then regenerate the Supabase TypeScript types.
```

---

## Prompt 2 — phone push notifications (optional)

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/09_push_notifications.sql on the connected Supabase
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
5. Run sql-to-run/10_push_setup_after_keys.sql, replacing
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
