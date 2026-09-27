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

### 1. Garage car removal reason (`ownership_end_reason`)

- File: `drizzle/migrations/0030_garage_car_ownership_end_reason.sql`
- Added: 2026-09-27
- Needed by: saving *why* a car left the garage (Sold / Scrapped / Written
  off / Other). Until this runs the car still moves to Previously owned,
  but the reason isn't saved and its badge just says "Previously owned".
- Safe: adds one optional column, deletes or changes nothing, fine to run
  more than once.

```sql
ALTER TABLE public.garage_cars
  ADD COLUMN IF NOT EXISTS ownership_end_reason text
  CHECK (ownership_end_reason IN ('sold', 'scrapped', 'written_off', 'other'));
```

### 2. Social features pack

- File: `drizzle/migrations/0031_social_features.sql` (run the **whole
  file** — it's long, so paste it from the repo rather than retyping)
- Added: 2026-09-27
- Switches on, all at once:
  - Car meets & events (Going / Interested, reminder the day before)
  - Replies and likes on comments
  - Notifications when someone @mentions you
  - Video posts (raises the post upload limit to 50MB and allows MP4/MOV/WebM)
  - Saved posts
  - Reposts
  - Polls
  - The "Spotted" category, linking a photo to the owner's car
  - Verified badges (club / trader / creator), set by admins in Admin → People
- Safe: only adds tables, columns and rules. No posts, comments, cars or
  profiles are deleted or changed. It was tested against a copy of the
  full database schema before being committed.
- Lovable prompt you can paste: *"Please run the SQL migration
  `drizzle/migrations/0031_social_features.sql` exactly as committed. Run
  the first line (`ALTER TYPE … ADD VALUE 'spotted'`) on its own first,
  then the rest of the file."*

### 3. Phone push notifications (optional, needs a few setup steps)

- File: `drizzle/migrations/0032_push_notifications.sql` — run after item 2.
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
  5. Tell the database where the function is (SQL editor), using your own
     project URL and the same random password as step 3:
     ```sql
     SELECT vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
     SELECT vault.create_secret('<the PUSH_WEBHOOK_SECRET value>', 'push_webhook_secret');
     ```
- On iPhone, push only works once RevMate is added to the Home Screen
  (Share → Add to Home Screen) and opened from there.

## Applied

_Nothing yet._
