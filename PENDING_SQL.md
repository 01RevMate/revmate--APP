# Pending SQL — not yet applied

SQL that has been committed but **not yet run** on the live database. Run
each item in order, then move it to the "Applied" section with the date.

The app is built to keep working before each item runs — new features
simply stay hidden until their SQL is in place.

**Quickest way:** the file below is ready to run in the `sql-to-run/`
folder. `LOVABLE_PENDING_SQL_PROMPT.md` has copy-and-paste Lovable prompts.

## Pending

### Buy & Sell upgrade (needed for the new marketplace features)

- File: `drizzle/migrations/0051_marketplace_upgrade.sql` (`sql-to-run/17_marketplace_upgrade.sql`).
- Added: 2026-10-01
- Needed by: saved searches & alerts, Make an offer, parts category /
  condition / postage, distance search, MPG / CO2 / insurance group,
  "Who bought it?" + seller reviews, and the seller trust panel. Until it
  runs those stay hidden; the price guide, similar listings, compare, the
  "Fits your car" badge, photo guide and MOT link work straight away.
- Adds listing columns, `saved_searches` (+ `saved_search_hits`),
  `listing_offers`, `seller_reviews`, the RPCs `make_offer`,
  `respond_to_offer`, `listing_buyer_candidates`, `set_listing_buyer`,
  `leave_seller_review`, `seller_stats`, and new notification kinds
  `search_alert`, `offer`, `offer_update`, `review_request`. Safe to run
  more than once; doesn't change existing data.

### 1. Phone push notifications (optional, needs a few setup steps)

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
