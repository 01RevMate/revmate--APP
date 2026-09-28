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

### 4. Phone push notifications (optional, needs a few setup steps)

- File: `drizzle/migrations/0032_push_notifications.sql` (`sql-to-run/11_push_notifications.sql`).
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
  5. Tell the database where the function is — `sql-to-run/12_push_setup_after_keys.sql`,
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
