# Pending SQL — not yet applied

SQL that has been committed but **not yet run** on the live database. Run
each item in order, then move it to the "Applied" section with the date.

The app is built to keep working before each item runs — new features
simply stay hidden until their SQL is in place.

**Quickest way:** the file below is ready to run in the `sql-to-run/`
folder. `LOVABLE_PENDING_SQL_PROMPT.md` has copy-and-paste Lovable prompts.

## Pending

### G3. "Get a fixed-price quote" slot on fault pages (growth foundations)

- File: `drizzle/migrations/0085_fault_quote_deal_slot.sql` (`sql-to-run/38_fault_quote_deal_slot.sql`).
  Rollback: `drizzle/migrations/0085_fault_quote_deal_slot_down.sql`.
- Added: 2026-11-22.
- Adds a `faults` placement to Deals and a starter BookMyGarage deal that is **switched off**, pointing at
  its normal website. Don't switch it on until it carries your tracking link (Admin → Money → Deals).
  Anything shown is labelled "Ad" and hidden for Plus members. Until this runs, the slot simply doesn't show.

### G2. Fault library schema (growth foundations, run before importing any faults)

- File: `drizzle/migrations/0084_fault_library_schema.sql` (`sql-to-run/37_fault_library_schema.sql`).
  Rollback (deletes nothing): `drizzle/migrations/0084_fault_library_schema_down.sql`.
- Added: 2026-11-22.
- Adds the `editorial` fault source and two columns on `car_faults`: `cost_source_url` and `last_checked`.
- **Effect on the live site once the new code is deployed:** car pages only show a cost range when
  `cost_source_url` is set, so the 11 AI-written cost ranges stop showing (the text stays) until sourced.
  This applies even before this SQL runs.
- The fault drafts in `data/fault-library/` are imported separately, after Jordan has reviewed them:
  `bun run faults:validate`, then `bun run faults:import` (see `data/fault-library/README.md`).

### G1. Fault search that scales and matches words (growth foundations)

- File: `drizzle/migrations/0083_search_issue_posts.sql` (`sql-to-run/36_search_issue_posts.sql`).
  Rollback (touches no posts): `drizzle/migrations/0083_search_issue_posts_down.sql`.
- Added: 2026-11-22.
- Adds `search_issue_posts()` (database filter by make/model/part, word-based full-text matching on the post
  and its fix, fixed posts first, paged) and a GIN index on fault posts. `SECURITY INVOKER`, so the existing
  signed-out rules (adults only, no groups) still apply.
- Until it runs, `/issues` keeps working with its earlier method (newest 300 fault posts, filtered in the
  browser) and the word-search box stays hidden (`useIssueSearchFeature()` in `src/lib/features.ts`).

### 0. Business foundation: approvals, tiers, follows, photo checks (Phase 1)

- File: `drizzle/migrations/0080_business_foundation.sql` (`sql-to-run/33_business_foundation.sql`).
  Rollback that keeps all collected data: `drizzle/migrations/0080_business_foundation_down.sql`.
- Added: 2026-11-15. **Do not run until the `business-phase-1` pull request has been reviewed and approved.**
- Adds the approval workflow (`draft → pending → approved / needs_changes / rejected / appealed`), suspension,
  listing/full tiers, reviewed edits to live businesses, personal-account follows (count only), photo review
  and photo reports, an approval log, and a snapshot table `business_foundation_backup_20261115`.
  Every business that is live today is kept online and marked as a legacy approval.
- Until it runs, the new tools stay hidden (the app checks `business_foundation_ready()` and treats anything
  other than `true` as off), and existing pages work as before.

### 0b. Business trust and safety (Phase 2, needs 0080 first)

- File: `drizzle/migrations/0081_business_trust_safety.sql` (`sql-to-run/34_business_trust_safety.sql`).
  Rollback that keeps all collected data: `drizzle/migrations/0081_business_trust_safety_down.sql`.
- Added: 2026-11-15. **Do not run until the `business-phase-2` pull request has been reviewed and approved.**
- Adds smoothed ratings and a trust level calculated in the database, upheld-only report counts, review flags
  (new accounts, same-company email, bursts) that go to an admin queue and never suspend anyone, per-review
  reports, owner appeals, daily limits on reviews and reports, and a confirmed-email / day-old-account rule for
  creating a business. Snapshot of the old numbers: `business_trust_backup_20261115`.
- Until it runs, the new trust tools stay hidden (the app checks `business_trust_ready()`).

### 0c. Business discovery: search for every member (Phase 3, needs 0080 and 0081 first)

- File: `drizzle/migrations/0082_business_discovery.sql` (`sql-to-run/35_business_discovery.sql`).
  Rollback: `drizzle/migrations/0082_business_discovery_down.sql` (keeps the `serves_nationwide` column and data).
- Added: 2026-11-15. **Do not run until the `business-phase-3` pull request has been reviewed and approved.**
- Adds `search_businesses()` (ranked by relevance, closeness to the member's area and trust, never by payment;
  only approved, non-suspended businesses) and a "serves nationwide" option for businesses.
- Until it runs, the directory keeps its earlier search (the app checks `business_discovery_ready()`).

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

- 2026-10-20: member business management (0071) applied; owners can create unverified business profiles and manage public contact names and logos without changing ownership, verification, suspension or promotion.

- 2026-10-20: step 30 business profiles applied exactly as committed as
  `drizzle/migrations/0070_apply_business_profiles_step_30.sql`. Types
  regenerated; `SELECT count(*) FROM public.business_photos;` returned 0.
  Original moved unchanged to `sql-to-run/applied/30_business_profiles.sql`.

- 2026-10-20: steps 23–29 run together with the master Lovable prompt —
  launch kit (0063), money (0064), campaigns (0065), diagnosis & shops (0066),
  store (0067), auctions (0068), feed & badges (0069). Files moved to
  `sql-to-run/applied/`.
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
