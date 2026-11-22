# SQL to run

Every database update that's in the code but **hasn't been run on the live
database yet**, numbered in the order to run them. Files that have already
been run live in `applied/` for reference.

| # | File | What it does | Status |
|---|------|--------------|--------|
| 30 | `30_business_profiles.sql` | Business photo galleries, review photos, owner replies, opening hours, more sectors | **Run this** |
| 33 | `33_business_foundation.sql` | Business approvals, tiers, edit review, follows, photo checks (rollback: `drizzle/migrations/0080_business_foundation_down.sql`) | **Run this, after the business-phase-1 pull request is approved** |
| 34 | `34_business_trust_safety.sql` | Business trust and safety: smoothed ratings, review flags and reports, appeals, spam limits (rollback: `drizzle/migrations/0081_business_trust_safety_down.sql`). Needs 33 first. | **Run after 33, once the business-phase-2 pull request is approved** |
| 35 | `35_business_discovery.sql` | Business search for every member: ranked search, nationwide option, rating / open-now filters (rollback: `drizzle/migrations/0082_business_discovery_down.sql`). Needs 33 and 34 first. | **Run after 34, once the business-phase-3 pull request is approved** |
| 36 | `applied/36_search_issue_posts.sql` | Fault search that scales and matches words (rollback: `drizzle/migrations/0083_search_issue_posts_down.sql`) | Applied 22 Nov 2026 |
| 37 | `applied/37_fault_library_schema.sql` | Fault library: `editorial` source, `cost_source_url`, `last_checked` (rollback: `drizzle/migrations/0084_fault_library_schema_down.sql`) | Applied 22 Nov 2026 |
| 38 | `applied/38_fault_quote_deal_slot.sql` | `faults` Deals placement and a switched-off BookMyGarage starter deal (rollback: `drizzle/migrations/0085_fault_quote_deal_slot_down.sql`) | Applied 22 Nov 2026 |
| 39 | `applied/39_hide_unsourced_ai_faults.sql` | Hide unsourced AI fault claims from public reads; retain the records (rollback: `drizzle/migrations/0086_hide_unsourced_ai_faults_down.sql`) | Applied 22 Nov 2026 |
| 13 | `13_push_notifications.sql` | Phone push notifications | Optional |
| 14 | `14_push_setup_after_keys.sql` | Connects the database to the push sender | Only with 13, after the keys are set up |

Already applied (in `applied/`): 1–4 on 27 Sep 2026, 5–12 on 28 Sep 2026,
15–18 on 1 Oct 2026, 19 on 2 Oct 2026, 20–21 on 5 Oct 2026, 22 by 19 Oct 2026, and 23–29 on 20 Oct 2026.

## Two ways to run them

**Easiest — ask Lovable.** Open `LOVABLE_PENDING_SQL_PROMPT.md` (in the main
folder), copy Prompt H (business profiles) and, if you want it, Prompt 1 (phone notifications), and paste each into Lovable.

**Or run them yourself** in the Supabase SQL editor (Lovable Cloud → Database
→ SQL editor): open each file here in order, copy the whole file, paste,
run, and wait for it to finish before starting the next one.

Files only *add* things — no posts, cars, profiles or messages are deleted
or changed. They were test-run against a copy of the full database schema
before being committed.

The app already works without them: each feature simply stays hidden until
its SQL has run, then appears on its own.

File 15 is a copy of `drizzle/migrations/0047_live_messages.sql` with a short header added.
File 16 is a copy of `drizzle/migrations/0048_diagnostics_audio_category.sql` with a short header added.
File 18 is a copy of `drizzle/migrations/0052_group_covers_and_socials.sql` with a short header added.
File 17 is a copy of `drizzle/migrations/0051_marketplace_upgrade.sql` with a short header added.
File 19 is a copy of `drizzle/migrations/0055_public_profiles.sql` with a short header added.
File 13 is a copy of `drizzle/migrations/0032_push_notifications.sql` with a short header added.
File 20 is a copy of `drizzle/migrations/0057_remove_post_location.sql`.
File 21 is a copy of `drizzle/migrations/0058_security_hardening.sql`.
File 22 is a copy of `drizzle/migrations/0060_group_icons.sql`.
File 23 is a copy of `drizzle/migrations/0063_launch_kit.sql` with a short header added.
File 24 is a copy of `drizzle/migrations/0064_money.sql` with a short header added.
File 25 is a copy of `drizzle/migrations/0065_campaigns.sql` with a short header added.
File 26 is a copy of `drizzle/migrations/0066_diagnosis_and_shops.sql` with a short header added.
File 27 is a copy of `drizzle/migrations/0067_store.sql` with a short header added.
File 28 is a copy of `drizzle/migrations/0068_auctions.sql` with a short header added.
File 29 is a copy of `drizzle/migrations/0069_feed_and_badges.sql` with a short header added.
