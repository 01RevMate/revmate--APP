# Pending SQL — not yet applied

SQL that has been committed but **not yet run** on the live database. Run
each item in order, then move it to the "Applied" section with the date.

The app is built to keep working before each item runs — new features
simply stay hidden until their SQL is in place.

**Quickest way:** the file below is ready to run in the `sql-to-run/`
folder. `LOVABLE_PENDING_SQL_PROMPT.md` has copy-and-paste Lovable prompts.

## Pending

### 1. Launch kit (feedback, launch stats, Founding member badges)

- File: `drizzle/migrations/0063_launch_kit.sql` (`sql-to-run/23_launch_kit.sql`).
- Added: 2026-10-19
- Needed by: **Send feedback** (Settings and the menu), the **Launch** tab in
  Admin, and the **Founding member** badge and "spots left" invite. Until it
  runs, all of these stay hidden.
- Adds the `app_feedback` table (members can send, only admins can read),
  `public.founding_members` with numbers 1–100, `founding_spots_left()` and
  the admin-only `admin_launch_stats()`. Everyone who already has an account
  gets a founding number in sign-up order when it runs.

### 2. Money (paid extras, Plus, Business Pro, deals, shop, sponsors)

- File: `drizzle/migrations/0064_money.sql` (`sql-to-run/24_money.sql`). Run after item 1.
- Added: 2026-10-19
- Needed by: Admin → Money, Deals on Essentials / EV chargers / fuel prices,
  the shop link, sponsored challenges, and (once payments are switched on)
  featured adverts, RevMate Plus and Business Pro. Until it runs, all of
  these stay hidden.
- Adds `app_settings`, `paid_products`, `payments`, `subscriptions`,
  `billing_customers`, `affiliate_deals`, `businesses.promoted_until`,
  sponsor columns on `challenges`, and service-role-only `billing_*`
  functions used by the `stripe-webhook` edge function.
- Payments stay **off** until an admin switches them on. Card payments also
  need Stripe set up — see `MONETISATION_SETUP.md`.

### 3. Campaigns (TikTok tracking without tracking people)

- File: `drizzle/migrations/0065_campaigns.sql` (`sql-to-run/25_campaigns.sql`). Run after item 2.
- Added: 2026-10-19
- Needed by: Admin → Marketing "What's working" (visits and sign-ups per
  campaign). Adds `campaign_visits` (daily counts, no personal data),
  `signup_sources` (filled from the sign-up form's `attribution`), the
  admin-only `admin_campaign_stats()`, and empty `tiktok_pixel_id`,
  `android_package` and `android_fingerprint` settings.

### 4. AI diagnosis limits + Shops

- File: `drizzle/migrations/0066_diagnosis_and_shops.sql` (`sql-to-run/26_diagnosis_and_shops.sql`). Run after item 3.
- Added: 2026-10-20
- Needed by: the Shops directory (`/shops`, "List your shop", Admin →
  Shops & AI) and the "Ask RevMate AI" step in Fix a problem. The built-in
  step-by-step diagnosis at `/diagnose` works without it.
- Adds `ai_usage` + service-role-only `ai_take_credit()` (AI is off until an
  admin switches it on; whole-site and per-person daily caps), the admin-only
  `admin_ai_usage()`, `shops` and `shop_products` (owners apply, admins
  approve; owners can't approve or promote themselves), and
  `record_shop_click()`.
- AI also needs the `diagnose` edge function deployed and an
  `ANTHROPIC_API_KEY` secret — see `AI_DIAGNOSIS_SETUP.md`.

### 5. Phone push notifications (optional, needs a few setup steps)

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

- Group icons (`sql-to-run/applied/22_group_icons.sql`, 0060) — applied by Lovable by 19 October 2026.


- 2026-10-05: remove location from posts — 0057 (`sql-to-run/20`). Found
  already applied to the live database by hand: `posts.latitude` /
  `posts.longitude`, `private.round_post_location()`, its trigger,
  `public.nearby_posts`, the `posts_location_adults_only` policy and the
  `posts_location_idx` index are all gone (verified via information_schema).
  The committed re-runnable copy therefore has nothing left to do; file
  moved to `sql-to-run/applied/`. Types regenerated — the only remaining
  location fields are on car_meets / nearby_meets (meet locations, kept on
  purpose). Build OK.

- 2026-10-05: security fixes — 0058/0059 (`sql-to-run/21`). Applied by
  Lovable exactly as committed: counter guard triggers on posts,
  garage_cars, car_meets, post_comments and stories with recounts;
  private.is_known_adult + anon_adults_only restrictive policies on nine
  tables; admin-only inserts on cars and car_faults; NOT VALID https checks
  on the three social link columns; public.is_admin revoked from anon.
  Types regenerated; build OK. File moved to `sql-to-run/applied/`.

- 2026-10-02: public profile pages — 0055/0056 (`sql-to-run/19`).
  Applied by Lovable and verified live: `public.public_profile(text)` and
  `public.public_profile_handles(int)` both callable with the public
  (signed-out) key; `profiles_username_ci_idx` present. File moved to
  `sql-to-run/applied/`.

- 2026-10-01: Buy & Sell upgrade (0051/0053, `sql-to-run/17`) and group
  covers + more social links (0052/0054, `sql-to-run/18`) — both applied by
  Lovable and verified live (tables, listing columns, RPCs, cover_url and
  the three new social link columns all present). Files moved to
  `sql-to-run/applied/`.

- 2026-10-01: live unread-message badge — 0047/0050 (`sql-to-run/15`).
  Added `messages` to Supabase Realtime and the `messages_unread_idx`
  index; verified `messages` is in the realtime publication.

- 2026-10-01: Speakers / Sound diagnostics category — 0048/0049
  (`sql-to-run/16`, now applied and moved to `sql-to-run/applied/`).
  Widened `posts_issue_system_check` to allow 'audio'.

- 2026-09-28 (second batch): announcements (0042), listing details (0043),
  RevMate News (0044), car care / diagnostics / For You (0045) and
  businesses & ads (0046) — `sql-to-run/applied/08`–`12`, run by hand in the
  SQL editor.

- 2026-09-28: marketplace (0035), group entry rules (0036) and age checks &
  consent (0037) — `sql-to-run/applied/05`–`07`. Lovable also recorded these
  as 0038–0040 and added 0041 (tighter car and fault submission rules).
- 2026-09-27: removal reason (0030/0034), social features (0031), engagement
  (0033) and the existing-profiles update — `sql-to-run/applied/01`–`04`.
