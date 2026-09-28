# Lovable prompts — run outstanding RevMate SQL

Steps 1–4 in `sql-to-run/` were applied on 27 September 2026. Copy a prompt
below (everything inside the box) and paste it into Lovable.

---

## All-in-one — run steps 5 to 8 together (easiest)

```
Please run these four files from the repo's sql-to-run folder on the
connected Supabase database, one at a time and in this order, exactly as
committed. Don't rewrite, merge or simplify them, and don't recreate their
functions in your own words — use each file as it is. Wait for each to
finish before starting the next, and stop and tell me if any of them fails.

1. sql-to-run/05_marketplace.sql
2. sql-to-run/06_group_rules.sql
3. sql-to-run/07_age_and_consent.sql
4. sql-to-run/08_announcements.sql

They only add columns, tables, triggers, functions and security rules. No
existing posts, cars, profiles, listings or messages are deleted.

When all four have finished, please confirm:
- public.listings has previous_price, price_changed_at, views_count,
  saves_count, featured_until and location_area
- saved_listings, listing_views, marketplace_partners, group_questions,
  group_join_answers, account_consents, announcements and
  announcement_views exist with row level security on
- public.community_groups has entry_rule, allow_sales and
  require_rules_agreement
- these functions exist: record_listing_view, record_partner_click,
  join_group, group_entry_eligibility, record_consents,
  set_marketing_consent, delete_my_account, announcement_stats
- the triggers enforce_group_post_rules (on public.posts) and
  on_auth_user_created_consents (on auth.users) exist

Then regenerate the Supabase TypeScript types.
```

Or run them one by one with Prompts 1–4 below.

---

## Prompt 1 — marketplace update (do this one)

```
Please run sql-to-run/05_marketplace.sql from the repo on the connected
Supabase database, exactly as committed. Don't rewrite, merge or simplify it,
and don't recreate its functions in your own words — use the file as it is.
Stop and tell me if it fails.

It only adds things: new columns on public.listings (previous_price,
price_changed_at, views_count, saves_count, featured_until, location_area),
new tables saved_listings, listing_views and marketplace_partners, triggers
that track price drops and protect the counters, and the functions
record_listing_view and record_partner_click. No existing listings are
deleted or changed.

When it has finished, please confirm:
- public.listings has the six new columns above
- saved_listings, listing_views and marketplace_partners exist with row
  level security enabled
- the notifications kind check now allows 'price_drop'
- record_listing_view and record_partner_click exist

Then regenerate the Supabase TypeScript types.
```

---

## Prompt 2 — group entry rules (do this one, after Prompt 1)

```
Please run sql-to-run/06_group_rules.sql from the repo on the connected
Supabase database, exactly as committed. Don't rewrite, merge or simplify it,
and don't recreate its functions in your own words — use the file as it is.
Stop and tell me if it fails.

It adds entry_rule, allow_sales and require_rules_agreement columns to
public.community_groups, new tables group_questions and group_join_answers,
the functions join_group and group_entry_eligibility, a posting-rules
trigger on public.posts, and replaces manage_group_member with the same
logic plus entry checks. Existing groups are not changed (they stay open).

When it has finished, please confirm:
- public.community_groups has entry_rule, allow_sales and
  require_rules_agreement
- group_questions and group_join_answers exist with row level security on
- join_group and group_entry_eligibility exist
- the enforce_group_post_rules trigger exists on public.posts

Then regenerate the Supabase TypeScript types.
```

---

## Prompt 3 — age checks and account deletion (do this one, after Prompt 2)

```
Please run sql-to-run/07_age_and_consent.sql from the repo on the connected
Supabase database, exactly as committed. Don't rewrite, merge or simplify it,
and don't recreate its functions in your own words — use the file as it is.
Stop and tell me if it fails.

It adds a public.account_consents table (row level security: people can
only read their own row), a trigger on auth.users that records the date of
birth and agreed terms versions from sign-up metadata and refuses under-13
sign-ups, the functions record_consents, set_marketing_consent and
delete_my_account, and restrictive row level security policies that limit
listings, car meets and post locations to 18+ and direct messages to 16+.
No existing data is changed.

When it has finished, please confirm:
- public.account_consents exists with row level security enabled
- the on_auth_user_created_consents trigger exists on auth.users
- record_consents, set_marketing_consent and delete_my_account exist
- the policies listings_adults_only, car_meets_adults_only,
  posts_location_adults_only, conversations_16_plus and messages_16_plus exist

Then regenerate the Supabase TypeScript types.
```

---

## Prompt 4 — pop-up announcements (after Prompt 3)

```
Please run sql-to-run/08_announcements.sql from the repo on the connected
Supabase database, exactly as committed. Don't rewrite, merge or simplify it,
and don't recreate its functions in your own words — use the file as it is.
Stop and tell me if it fails.

It adds public.announcements and public.announcement_views (row level
security on: only admins can create or edit announcements; members only see
live ones meant for them and only their own views), a trigger that stamps
who created each announcement, and the admin-only function
announcement_stats. No existing data is changed.

When it has finished, please confirm both tables exist with row level
security enabled and announcement_stats exists, then regenerate the
Supabase TypeScript types.
```

---

## Prompt 5 — phone push notifications (optional)

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/09_push_notifications.sql on the connected Supabase
   database, exactly as committed (it enables the pg_net extension and adds
   a push_subscriptions table and a trigger on notifications).
2. Generate a VAPID key pair for web push.
3. Add these edge function secrets:
   - VAPID_PUBLIC_KEY  = the generated public key
   - VAPID_PRIVATE_KEY = the generated private key
   - VAPID_SUBJECT     = mailto:<my email address>
   - PUSH_WEBHOOK_SECRET = a new long random string
4. Deploy (or redeploy) the edge function in supabase/functions/send-push
   (it must allow calls without a user JWT — supabase/config.toml already
   sets verify_jwt = false for it).
5. Run sql-to-run/10_push_setup_after_keys.sql, replacing
   <PUSH_WEBHOOK_SECRET> with the same value used in step 3.

Then confirm the send-push function returns a publicKey on a GET request.
```

---

When something has run, move it to the "Applied" section of
`PENDING_SQL.md` (or ask Claude/Lovable to do it).
