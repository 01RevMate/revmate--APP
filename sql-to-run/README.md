# SQL to run

Every database update that's in the code but **hasn't been run on the live
database yet**, numbered in the order to run them. Files that have already
been run live in `applied/` for reference.

| # | File | What it does | Status |
|---|------|--------------|--------|
| 23 | `23_launch_kit.sql` | Feedback box, admin launch stats, Founding member badges | **Run this** |
| 24 | `24_money.sql` | Paid extras, Plus, Business Pro, deals, shop link, sponsors | **Run this** (after 23) |
| 25 | `25_campaigns.sql` | TikTok campaign counts, sign-up sources, Pixel and Android settings | **Run this** (after 24) |
| 13 | `13_push_notifications.sql` | Phone push notifications | Optional |
| 14 | `14_push_setup_after_keys.sql` | Connects the database to the push sender | Only with 13, after the keys are set up |

Already applied (in `applied/`): 1–4 on 27 Sep 2026, 5–12 on 28 Sep 2026,
15–18 on 1 Oct 2026, 19 on 2 Oct 2026, 20–21 on 5 Oct 2026, and 22 by 19 Oct 2026.

## Two ways to run them

**Easiest — ask Lovable.** Open `LOVABLE_PENDING_SQL_PROMPT.md` (in the main
folder), copy Prompt A (launch kit), Prompt B (money), Prompt C (campaigns) and, if you want them, Prompt 1
(phone notifications), and paste each into Lovable.

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
