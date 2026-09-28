# Lovable prompts — run outstanding RevMate SQL

Steps 1–7 in `sql-to-run/` have been applied (the last batch on 28 September
2026) and their files are kept in `sql-to-run/applied/`. This is the new
pack. Copy a prompt below (everything inside the box) and paste it into
Lovable.

---

## All-in-one — run steps 8, 9 and 10 together (easiest)

```
Please run these three files from the repo's sql-to-run folder on the
connected Supabase database, one at a time and in this order, exactly as
committed. Don't rewrite, merge or simplify them, and don't recreate their
functions in your own words — use each file as it is. Wait for each to
finish before starting the next, and stop and tell me if any of them fails.

1. sql-to-run/08_announcements.sql
2. sql-to-run/09_listing_details.sql
3. sql-to-run/10_revmate_news.sql

They only add tables, columns, triggers, functions and security rules. No
existing posts, cars, profiles, listings or messages are deleted (step 9
fills in make, model and year on existing listings from their garage car).

When all three have finished, please confirm:
- announcements, announcement_views, news_posts and news_likes exist with
  row level security enabled
- public.listings has the new columns make, model, year, fuel_type,
  transmission, body_type, engine_size_cc, power_bhp, colour, doors, seats,
  previous_owners, mot_expiry, service_history, seller_type,
  ulez_compliant, v5c_present and modified
- the function announcement_stats exists

Then regenerate the Supabase TypeScript types.
```

Or run them one by one with Prompts 1–3 below.

---

## Prompt 1 — pop-up announcements

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

## Prompt 2 — vehicle details on listings

```
Please run sql-to-run/09_listing_details.sql from the repo on the connected
Supabase database, exactly as committed (after 08_announcements.sql). Don't
rewrite or simplify it. Stop and tell me if it fails.

It adds optional vehicle detail columns to public.listings (make, model,
year, fuel_type, transmission, body_type, engine_size_cc, power_bhp, colour,
doors, seats, previous_owners, mot_expiry, service_history, seller_type,
ulez_compliant, v5c_present, modified), an index, a trigger that copies
make/model/year from the linked garage car, and fills those in for existing
listings. Nothing is deleted.

When it has finished, confirm the columns exist, then regenerate the
Supabase TypeScript types.
```

---

## Prompt 3 — RevMate News

```
Please run sql-to-run/10_revmate_news.sql from the repo on the connected
Supabase database, exactly as committed (after 09_listing_details.sql).
Don't rewrite or simplify it. Stop and tell me if it fails.

It adds public.news_posts and public.news_likes (row level security on:
only admins can write news posts; everyone sees live ones; members can like
them and only see their own likes) plus triggers that protect the like
count. Nothing existing is changed.

When it has finished, confirm both tables exist with row level security
enabled, then regenerate the Supabase TypeScript types.
```

---

## Prompt 4 — phone push notifications (optional)

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/11_push_notifications.sql on the connected Supabase
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
5. Run sql-to-run/12_push_setup_after_keys.sql, replacing
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
