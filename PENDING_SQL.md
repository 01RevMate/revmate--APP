# Pending SQL — not yet applied

SQL that has been committed but **not yet run** on the live database. Run
each item in order (in Lovable, or the Supabase SQL editor), then move it
to the "Applied" section with the date.

The app is built to keep working before each item runs — new features
simply stay hidden until their SQL is in place.

**Quickest way:** every file below is ready to run, numbered in order, in the
`sql-to-run/` folder. `LOVABLE_PENDING_SQL_PROMPT.md` has copy-and-paste
Lovable prompts.

## Pending

### 1. Pop-up announcements

- File: `drizzle/migrations/0042_announcements.sql` (`sql-to-run/08_announcements.sql`)
- Added: 2026-09-28
- Switches on: Admin → App Updates → Pop-up announcements (prefilled from
  the latest update or a custom message, with image, button, audience and
  start/end times) and the pop-up members see once when they open the app.
- Until this runs: nothing changes; the admin panel and pop-up stay hidden.
- Safe: only adds two tables, a trigger and functions. Tested against a
  copy of the full database schema (12 behaviour checks).

### 2. Vehicle details on listings

- File: `drizzle/migrations/0043_listing_details.sql` (`sql-to-run/09_listing_details.sql`)
- Added: 2026-09-28
- Switches on: the "Vehicle details" section on the sell form (fuel, gearbox,
  body, engine, power, colour, doors, seats, owners, MOT, service history,
  ULEZ, V5C, modified, private/trade), the spec sheet on listings, and the
  fuel/gearbox/body/seller/ULEZ/owners filters on Buy & Sell. Existing
  listings get make, model and year (and fuel, gearbox, colour, power where
  known) copied from their garage car.
- Until this runs: make, model, year and mileage filters and the new sorts
  already work; the rest stays hidden.
- Safe: only adds optional columns, an index and a trigger. Tested against
  a copy of the full database schema (listing checks + backfill check).

### 3. RevMate News

- File: `drizzle/migrations/0044_revmate_news.sql` (`sql-to-run/10_revmate_news.sql`)
- Added: 2026-09-28
- Switches on: Admin → RevMate News (write posts with a topic, photos,
  videos, optional button, sponsored label and publish time, with a live
  preview and on/off switch) and those posts in everyone's feed, which
  people can like.
- Until this runs: nothing changes; the admin tab stays hidden.
- Safe: only adds two tables, triggers and security rules. Tested against a
  copy of the full database schema (10 behaviour checks).

### 4. Car care, smart diagnostics and a smarter For You

- File: `drizzle/migrations/0045_car_care_diagnostics_feed.sql` (`sql-to-run/11_car_care_diagnostics_feed.sql`)
- Added: 2026-09-28
- Switches on: MOT and road tax dates with reminders (30, 7 and 1 day
  before, and if missed), diagnostic posts with the part of the car and
  resolved/unresolved plus the fix (likers and commenters are told when it's
  fixed; authors are nudged to update), Known issues per car and the
  Problems & fixes page, "what car is this about?" tags, a For You feed that
  learns from people's cars (brand tier, EV, modified or standard), and
  trending hashtag suggestions.
- Until this runs: none of these show; hashtag suggestions use a starter list.
- Safe: only adds columns, tables, triggers and functions, and replaces the
  For You feed function. Tested against a copy of the full database schema.

### 5. Local businesses and ads manager

- File: `drizzle/migrations/0046_businesses_and_ads.sql` (`sql-to-run/12_businesses_and_ads.sql`)
- Added: 2026-09-28
- Switches on: the business directory and pages with member reviews,
  reports and trust badges, Admin → Businesses and Admin → Ads (targeted
  sponsored cards in the feed with impressions and clicks), the "Your area"
  setting, and linking dealer listings to their business.
- Until this runs: nothing changes; the pages and admin tabs stay hidden.
- Safe: only adds tables, a column on listings, triggers and functions.
  Tested against a copy of the full database schema (30 checks with step 11).

### 6. Phone push notifications (optional, needs a few setup steps)

- File: `drizzle/migrations/0032_push_notifications.sql` (`sql-to-run/13_push_notifications.sql`).
- Added: 2026-09-27
- Needed by: the "Phone notifications" switch in Settings. Until this runs
  (and the steps below are done) the switch doesn't appear and everything
  else works normally.
- Setup, once:
  1. Run the SQL file above.
  2. Create a set of Web Push keys (Lovable can do this: *"generate a VAPID
     key pair for web push"*, or run `npx web-push generate-vapid-keys`).
  3. Add these edge function secrets in Lovable Cloud / Supabase:
     - `VAPID_PUBLIC_KEY` — the public key
     - `VAPID_PRIVATE_KEY` — the private key
     - `VAPID_SUBJECT` — `mailto:` followed by your email
     - `PUSH_WEBHOOK_SECRET` — any long random password you make up
  4. Deploy the edge function `supabase/functions/send-push`.
  5. Tell the database where the function is — `sql-to-run/14_push_setup_after_keys.sql`,
     with the same random password as step 3:
     ```sql
     SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
     SELECT vault.create_secret('<the PUSH_WEBHOOK_SECRET value>', 'push_webhook_secret');
     ```
- On iPhone, push only works once RevMate is added to the Home Screen
  (Share → Add to Home Screen) and opened from there.

## Applied

- 2026-09-28: marketplace (0035), group entry rules (0036) and age checks &
  consent (0037) — `sql-to-run/applied/05`–`07`. Lovable also recorded these
  as 0038–0040 and added 0041 (tighter car and fault submission rules).
- 2026-09-27: removal reason (0030/0034), social features (0031), engagement
  (0033) and the existing-profiles update — `sql-to-run/applied/01`–`04`.
