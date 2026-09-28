# SQL to run

Every database update that's in the code but **hasn't been run on the live
database yet**, numbered in the order to run them.

| # | File | What it does | Status |
|---|------|--------------|--------|
| 1 | `01_garage_car_removal_reason.sql` | Saving *why* a car left the garage | ✅ Applied 27 Sep 2026 |
| 2 | `02_social_features.sql` | Meets, comment replies & likes, mentions, video, saved posts, reposts, polls, Spotted, verified badges | ✅ Applied 27 Sep 2026 |
| 3 | `03_engagement.sql` | For You feed, onboarding, Car Battles, recaps, streaks, Revs, Stories, challenges, Near you, reactions, notification settings | ✅ Applied 27 Sep 2026 |
| 4 | `04_update_existing_profiles.sql` | Brought existing profiles up to date | ✅ Applied 27 Sep 2026 |
| 5 | `05_marketplace.sql` | Watchlist, price drops & alerts, view counts, Featured listings, sponsored partners, seller area | **To run** |
| 6 | `06_group_rules.sql` | Group entry rules (same brand / same car), entry questions, rules agreement, no-sales setting, post-as-matching-car | **To run** |
| 7 | `07_push_notifications.sql` | Phone push notifications | Optional |
| 8 | `08_push_setup_after_keys.sql` | Connects the database to the push sender | Only with 7, after the keys are set up |

## Two ways to run them

**Easiest — ask Lovable.** Open `LOVABLE_PENDING_SQL_PROMPT.md` (in the main
folder), copy Prompt 1 and paste it into Lovable, then Prompt 2. Prompt 3 does
the phone notifications.

**Or run them yourself** in the Supabase SQL editor (Lovable Cloud → Database
→ SQL editor): open each file here in order, copy the whole file, paste,
run, and wait for it to finish before starting the next one.

All files only *add* things — no posts, cars, profiles or messages are
deleted or changed. They were test-run against a copy of the full database
schema before being committed.

The app already works without them: each feature simply stays hidden until
its SQL has run, then appears on its own.

Files 1, 2, 3, 5, 6 and 7 are copies of the originals in `drizzle/migrations/`
(0030, 0031, 0033, 0035, 0036, 0032) with a short header added; file 4 was a
one-off update for existing profiles. Once they've all been run, this folder can
be deleted.
