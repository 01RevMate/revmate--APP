# Lovable prompts — run all outstanding RevMate SQL

Copy a prompt below (everything inside the box) and paste it into Lovable.
Send **Prompt 1** first. Prompt 2 is only needed for phone notifications.

The SQL files are in the `sql-to-run/` folder, numbered in the order they run.

---

## Prompt 1 — database updates (do this one)

```
Please run these SQL migration files from the repo on the connected Supabase
database, in this exact order, exactly as committed. Do not rewrite, merge or
simplify them, and don't recreate any functions in your own words — use the
files as they are.

1. sql-to-run/01_garage_car_removal_reason.sql
2. sql-to-run/02_social_features.sql
3. sql-to-run/03_engagement.sql

Notes:
- File 2 is long. Its very first statement (ALTER TYPE public.post_category
  ADD VALUE IF NOT EXISTS 'spotted') sits outside the BEGIN/COMMIT block on
  purpose. If your tool complains about running it inside a transaction, run
  that one line on its own first, then run the rest of the file.
- All three files only add things (tables, columns, triggers, policies,
  functions). They must not delete any existing posts, comments, cars,
  profiles or notifications. (File 3 fills in a new reaction_counts column on
  existing posts from their like counts — that's expected.)

When they've finished, please confirm:
- public.garage_cars has an ownership_end_reason column
- these tables exist with row level security enabled: car_meets,
  meet_attendees, comment_likes, saved_posts, post_poll_options,
  post_poll_votes
- public.posts has repost_of_id, reposts_count, spotted_garage_car_id and
  has_poll columns
- public.post_comments has parent_id and likes_count columns
- public.profiles has a verified_type column
- the post_category enum includes 'spotted'
- the post-images storage bucket now allows video/mp4, video/quicktime and
  video/webm with a 50MB limit
- these tables exist with row level security enabled: stories, story_views,
  car_battle_votes, car_of_the_week, weekly_recaps, challenges,
  notification_settings
- these functions exist: for_you_feed, suggested_profiles, next_car_battle,
  vote_car_battle, crown_car_of_the_week, send_my_weekly_recap,
  check_my_rank_changes, record_daily_activity, profile_level, revs_feed,
  nearby_meets, nearby_posts
- public.post_likes has a reaction column, and public.posts has
  reaction_counts, latitude and longitude columns

Then regenerate the Supabase TypeScript types.
```

---

## Prompt 2 — phone push notifications (optional)

Only send this after Prompt 1 has worked.

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/04_push_notifications.sql on the connected Supabase
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
5. Run sql-to-run/05_push_setup_after_keys.sql, replacing
   <PUSH_WEBHOOK_SECRET> with the same value used in step 3.

Then confirm the send-push function returns a publicKey on a GET request.
```

---

When everything has run, move the items in `PENDING_SQL.md` to its
"Applied" section (or ask Claude/Lovable to do it).
