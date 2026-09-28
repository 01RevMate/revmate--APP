# Lovable prompts — run outstanding RevMate SQL

Steps 1–4 in `sql-to-run/` were applied on 27 September 2026. Copy a prompt
below (everything inside the box) and paste it into Lovable.

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

## Prompt 3 — phone push notifications (optional)

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/07_push_notifications.sql on the connected Supabase
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
5. Run sql-to-run/08_push_setup_after_keys.sql, replacing
   <PUSH_WEBHOOK_SECRET> with the same value used in step 3.

Then confirm the send-push function returns a publicKey on a GET request.
```

---

When something has run, move it to the "Applied" section of
`PENDING_SQL.md` (or ask Claude/Lovable to do it).
