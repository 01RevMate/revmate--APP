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

### Speakers / Sound diagnostics category (quick)

- File: `drizzle/migrations/0048_diagnostics_audio_category.sql` (`sql-to-run/16_diagnostics_audio_category.sql`).
- Added: 2026-09-29
- Needed by: the "Speakers / Sound" option in the diagnostics post composer's
  "Which part of the car?" picker. Until this runs, picking it fails to save
  (the database rejects it); everything else works normally. Just widens a
  CHECK constraint — doesn't touch any data.

### Live unread-message badge (recommended, quick)

- File: `drizzle/migrations/0047_live_messages.sql` (`sql-to-run/15_live_messages.sql`).
- Added: 2026-09-28
- Needed by: the red unread count on Messages. It already works without this
  (it re-checks every 30 seconds); after it runs, the count and open chats
  update instantly. Adds `messages` to Supabase Realtime and an index for
  counting unread messages. Safe to run more than once; doesn't touch any data.

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

- 2026-09-28 (second batch): announcements (0042), listing details (0043),
  RevMate News (0044), car care / diagnostics / For You (0045) and
  businesses & ads (0046) — `sql-to-run/applied/08`–`12`, run by hand in the
  SQL editor.

- 2026-09-28: marketplace (0035), group entry rules (0036) and age checks &
  consent (0037) — `sql-to-run/applied/05`–`07`. Lovable also recorded these
  as 0038–0040 and added 0041 (tighter car and fault submission rules).
- 2026-09-27: removal reason (0030/0034), social features (0031), engagement
  (0033) and the existing-profiles update — `sql-to-run/applied/01`–`04`.
