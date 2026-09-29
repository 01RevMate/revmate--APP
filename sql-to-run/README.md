# SQL to run

Every database update that's in the code but **hasn't been run on the live
database yet**, numbered in the order to run them. Files that have already
been run live in `applied/` for reference.

| # | File | What it does | Status |
|---|------|--------------|--------|
| 13 | `13_push_notifications.sql` | Phone push notifications | Optional |
| 14 | `14_push_setup_after_keys.sql` | Connects the database to the push sender | Only with 13, after the keys are set up |
| 15 | `15_live_messages.sql` | Instant unread-message badge (live updates + fast count) | Recommended — can run on its own, before 13/14 |
| 16 | `16_diagnostics_audio_category.sql` | Adds "Speakers / Sound" as a diagnostics category | Can run on its own |

Already applied (in `applied/`): 1–4 on 27 Sep 2026 and 5–12 on 28 Sep 2026.

## Two ways to run them

**Easiest — ask Lovable.** Open `LOVABLE_PENDING_SQL_PROMPT.md` (in the main
folder), copy Prompt 1 (phone notifications) and paste it into Lovable.

**Or run them yourself** in the Supabase SQL editor (Lovable Cloud → Database
→ SQL editor): open each file here in order, copy the whole file, paste,
run, and wait for it to finish before starting the next one.

All files only *add* things — no posts, cars, profiles or messages are
deleted or changed. They were test-run against a copy of the full database
schema before being committed.

The app already works without them: each feature simply stays hidden until
its SQL has run, then appears on its own.

File 15 is a copy of `drizzle/migrations/0047_live_messages.sql` with a short header added.
File 16 is a copy of `drizzle/migrations/0048_diagnostics_audio_category.sql` with a short header added.
File 13 is a copy of `drizzle/migrations/0032_push_notifications.sql` with a short header added.
