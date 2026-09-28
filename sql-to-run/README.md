# SQL to run

Every database update that's in the code but **hasn't been run on the live
database yet**, numbered in the order to run them. Files that have already
been run live in `applied/` for reference.

| # | File | What it does | Status |
|---|------|--------------|--------|
| 8 | `08_announcements.sql` | Pop-up announcements with admin controls | **To run** |
| 9 | `09_listing_details.sql` | Full vehicle details on listings + Buy & Sell filters | **To run** |
| 10 | `10_revmate_news.sql` | RevMate News posts in feeds, with admin controls | **To run** |
| 11 | `11_car_care_diagnostics_feed.sql` | MOT & tax reminders, smart diagnostics, car tags, smarter For You, hashtag suggestions | **To run** |
| 12 | `12_businesses_and_ads.sql` | Local businesses, reviews, reports, ads manager, member area | **To run** |
| 13 | `13_push_notifications.sql` | Phone push notifications | Optional |
| 14 | `14_push_setup_after_keys.sql` | Connects the database to the push sender | Only with 13, after the keys are set up |

Already applied (in `applied/`): 1–4 on 27 Sep 2026 (removal reason, social
features, engagement, existing profiles) and 5–7 on 28 Sep 2026
(marketplace, group rules, age checks & consent).

## Two ways to run them

**Easiest — ask Lovable.** Open `LOVABLE_PENDING_SQL_PROMPT.md` (in the main
folder), copy the all-in-one prompt and paste it into Lovable. Prompt 4 does
the phone notifications.

**Or run them yourself** in the Supabase SQL editor (Lovable Cloud → Database
→ SQL editor): open each file here in order, copy the whole file, paste,
run, and wait for it to finish before starting the next one.

All files only *add* things — no posts, cars, profiles or messages are
deleted or changed. They were test-run against a copy of the full database
schema before being committed.

The app already works without them: each feature simply stays hidden until
its SQL has run, then appears on its own.

Files 8–13 are copies of the originals in `drizzle/migrations/`
(0042–0046 and 0032) with a short header added.
