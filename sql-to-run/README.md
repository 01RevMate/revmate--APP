# SQL to run

Every database update that's in the code but **hasn't been run on the live
database yet**, numbered in the order to run them.

| # | File | What it does | Needed? |
|---|------|--------------|---------|
| 1 | `01_garage_car_removal_reason.sql` | Saving *why* a car left the garage (sold / scrapped / written off / other) | Yes |
| 2 | `02_social_features.sql` | Meets & events, comment replies & likes, @mention notifications, video posts, saved posts, reposts, polls, Spotted, verified badges | Yes |
| 3 | `03_engagement.sql` | For You feed & onboarding, Car Battles & Car of the Week, weekly recaps & rank alerts, streaks & levels, Revs, Stories, weekly challenges, Near you, reactions, notification settings | Yes |
| 4 | `04_update_existing_profiles.sql` | Brings existing profiles up to date: favourite makes from their garage, starting leaderboard ranks, default notification settings | Yes |
| 5 | `05_push_notifications.sql` | Phone push notifications | Optional |
| 6 | `06_push_setup_after_keys.sql` | Connects the database to the push sender | Only with 5, after the keys are set up |

## Two ways to run them

**Easiest — ask Lovable.** Open `LOVABLE_PENDING_SQL_PROMPT.md` (in the main
folder), copy Prompt 1 and paste it into Lovable. Prompt 2 does the phone
notifications.

**Or run them yourself** in the Supabase SQL editor (Lovable Cloud → Database
→ SQL editor): open each file here in order, copy the whole file, paste,
run, and wait for it to finish before starting the next one.

All files only *add* things — no posts, cars, profiles or messages are
deleted or changed. They were test-run against a copy of the full database
schema before being committed.

The app already works without them: each feature simply stays hidden until
its SQL has run, then appears on its own.

Files 1, 2, 3 and 5 are copies of the originals in `drizzle/migrations/`
(0030, 0031, 0033, 0032) with a short header added; file 4 is a one-off
update for existing profiles. Once they've all been run, this folder can
be deleted.
