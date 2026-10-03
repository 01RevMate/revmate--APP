# Lovable prompts — run outstanding RevMate SQL

Steps 1–12 in `sql-to-run/` have all been applied (the latest, 8–12, on 28
September 2026). Steps 15 (live unread badge), 16 (Speakers / Sound
diagnostics), 17 (Buy & Sell upgrade), 18 (group covers + more social
links) and 19 (public profile pages) were applied on 1–2 October 2026.
Left to do: step 20 (remove location from posts), step 21 (security fixes)
and the optional phone notifications setup.

---

## ⭐ Prompt A — remove location from posts + security fixes

```
Please run these two files on the connected Supabase database, in order,
exactly as committed (both are safe to re-run):

1. sql-to-run/20_remove_post_location.sql (copy of
   drizzle/migrations/0057_remove_post_location.sql): drops
   public.nearby_posts, the round_post_location trigger and its function,
   the posts_location_adults_only policy, the posts_location_idx index and
   the latitude/longitude columns on public.posts. Meet locations
   (car_meets) are not touched.

2. sql-to-run/21_security_hardening.sql (copy of
   drizzle/migrations/0058_security_hardening.sql): adds a counter guard
   trigger (private.guard_member_counters) on posts, garage_cars,
   car_meets, post_comments and stories and recounts any counts that are
   wrong; adds private.is_known_adult and restrictive anon-only SELECT
   policies (anon_adults_only) on profiles, garage_cars, garage_car_photos,
   garage_mods, posts, post_comments, stories, meet_attendees and
   profile_follows; limits inserts on cars and car_faults to admins; adds
   NOT VALID https checks on profiles.social_instagram/facebook/tiktok; and
   revokes public.is_admin(uuid) from anon.

Then regenerate the Supabase TypeScript types and confirm the app builds.
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
