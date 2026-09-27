# Lovable prompts — run all outstanding RevMate SQL

Copy a prompt below (everything inside the box) and paste it into Lovable.
Send **Prompt 1** first. Prompt 2 is only needed for phone notifications.

The SQL files are in the `sql-to-run/` folder, numbered in the order they run.

---

## Prompt 1 — database updates and existing profiles (do this one)

```
Please run these SQL files from the repo on the connected Supabase database,
one at a time, in this exact order, exactly as committed. Do not rewrite,
merge or simplify them, and don't recreate any functions in your own words —
use the files as they are. Wait for each one to finish before starting the
next, and stop and tell me if any of them fails.

1. sql-to-run/01_garage_car_removal_reason.sql
2. sql-to-run/02_social_features.sql
3. sql-to-run/03_engagement.sql
4. sql-to-run/04_update_existing_profiles.sql

Notes:
- File 2's first statement (ALTER TYPE public.post_category ADD VALUE IF NOT
  EXISTS 'spotted') sits outside its BEGIN/COMMIT block on purpose. If your
  tool complains about running it inside a transaction, run that one line on
  its own first, then the rest of the file.
- Files 1–3 only add things (tables, columns, triggers, policies,
  functions). They must not delete any existing posts, comments, cars,
  profiles, listings, messages or notifications. File 3 fills a new
  reaction_counts column on existing posts from their like counts — that's
  expected.
- File 4 brings every existing profile up to date with the new features: it
  copies each person's current garage car makes into their favourite_makes
  (only where they haven't picked any), records a starting leaderboard rank
  (last_rank) for every current garage car so rank-up alerts work straight
  away, and creates a default notification_settings row for every profile.
  It only fills blanks, so it's safe to run again.

When they've finished, please confirm:
- public.garage_cars has ownership_end_reason, battle_wins, battle_losses and
  last_rank columns
- public.posts has repost_of_id, reposts_count, spotted_garage_car_id,
  has_poll, reaction_counts, latitude and longitude columns
- public.post_comments has parent_id and likes_count columns
- public.post_likes has a reaction column
- public.profiles has verified_type, favourite_makes, onboarded_at,
  current_streak, longest_streak and last_active_on columns
- the post_category enum includes 'spotted'
- the post-images storage bucket allows video/mp4, video/quicktime and
  video/webm with a 50MB limit
- these tables exist with row level security enabled: car_meets,
  meet_attendees, comment_likes, saved_posts, post_poll_options,
  post_poll_votes, stories, story_views, car_battle_votes, car_of_the_week,
  weekly_recaps, challenges, notification_settings
- these functions exist: send_due_meet_reminders, for_you_feed,
  suggested_profiles, next_car_battle, vote_car_battle,
  crown_car_of_the_week, send_my_weekly_recap, check_my_rank_changes,
  record_daily_activity, profile_level, revs_feed, nearby_meets, nearby_posts
- every profile now has a notification_settings row, every current garage
  car has a last_rank, and profiles that own cars have favourite_makes filled
  in (tell me how many of each were updated)

Then regenerate the Supabase TypeScript types.
```

---

## Prompt 2 — phone push notifications (optional)

Only send this after Prompt 1 has worked.

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/05_push_notifications.sql on the connected Supabase
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
5. Run sql-to-run/06_push_setup_after_keys.sql, replacing
   <PUSH_WEBHOOK_SECRET> with the same value used in step 3.

Then confirm the send-push function returns a publicKey on a GET request.
```

---

When everything has run, move the items in `PENDING_SQL.md` to its
"Applied" section (or ask Claude/Lovable to do it).
