# Pending SQL — not yet applied

SQL that has been committed but **not yet run** on the live database. Run
each item in order (in Lovable, or the Supabase SQL editor), then move it
to the "Applied" section with the date.

The app is built to keep working before each item runs — new features
simply stay hidden until their SQL is in place.

**Quickest way:** every file below is ready to run, numbered in order, in the
`sql-to-run/` folder. `LOVABLE_PENDING_SQL_PROMPT.md` has copy-and-paste
Lovable prompts that run them all.

## Pending

### 1. Marketplace pack

- File: `drizzle/migrations/0035_marketplace.sql` (`sql-to-run/05_marketplace.sql`)
- Added: 2026-09-27
- Switches on: the watchlist (heart on listings), price-drop tracking with
  "was £X" and alerts to watchers, honest view and watcher counts, Featured
  listings (set by admins on the listing page), sponsored partner tiles and
  banners (Admin → Partners), and an optional seller area on listings.
- Until this runs: the new Buy & Sell grid, filters, search, sorting and
  "new since your last visit" all work already; the features above stay hidden.
- Safe: only adds columns, tables, triggers and functions. Tested against a
  copy of the full database schema (14 behaviour checks).

### 2. Group entry rules and posting rules

- File: `drizzle/migrations/0036_group_rules.sql` (`sql-to-run/06_group_rules.sql`)
- Added: 2026-09-28
- Switches on: group entry gates (Everyone / same brand / same car, checked
  against the person's garage), posting only as a matching car in brand/car
  groups, the "no sales or advertising" setting, rules people must agree to,
  and Facebook-style entry questions (agree, yes/no, written) that
  moderators see with each join request. All editable later in the group's
  settings.
- Until this runs: groups work exactly as before; the new settings are hidden.
- Safe: only adds columns, tables, triggers and functions, and replaces
  `manage_group_member` with the same logic plus the entry checks. Existing
  groups stay open with sales allowed. Tested against a copy of the full
  database schema (25 behaviour checks).

### 3. Phone push notifications (optional, needs a few setup steps)

- File: `drizzle/migrations/0032_push_notifications.sql` (`sql-to-run/07_push_notifications.sql`).
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
  5. Tell the database where the function is — `sql-to-run/08_push_setup_after_keys.sql`,
     with the same random password as step 3:
     ```sql
     SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
     SELECT vault.create_secret('<the PUSH_WEBHOOK_SECRET value>', 'push_webhook_secret');
     ```
- On iPhone, push only works once RevMate is added to the Home Screen
  (Share → Add to Home Screen) and opened from there.

## Applied

- 2026-09-27: removal reason (0030/0034), social features (0031), engagement
  (0033) and the existing-profiles update — `sql-to-run/01`–`04`.
