# Lovable prompts — run outstanding RevMate SQL

Steps 1–12 in `sql-to-run/` have all been applied (the latest, 8–12, on 28
September 2026). Steps 15 (live unread badge) and 16 (Speakers / Sound
diagnostics) were applied on 1 October 2026. Left to do: the Buy & Sell
upgrade (Prompt 0, needed) and the optional phone notifications setup.

---

## Prompt 0 — Buy & Sell upgrade (needed)

```
Please run sql-to-run/17_marketplace_upgrade.sql on the connected Supabase
database, exactly as committed (it's a copy of
drizzle/migrations/0051_marketplace_upgrade.sql and is safe to run more
than once). It adds listing columns (part category, condition, postage,
postcode district + rough location, CO2, MPG, insurance group,
open_to_offers, buyer_id), the tables saved_searches, saved_search_hits,
listing_offers and seller_reviews, the functions make_offer,
respond_to_offer, listing_buyer_candidates, set_listing_buyer,
leave_seller_review and seller_stats, and four notification kinds. It
doesn't change any existing data. Then regenerate the Supabase TypeScript
types and confirm the app still builds.
```

---

## Prompt 0b — group covers and more social links

```
Please run sql-to-run/18_group_covers_and_socials.sql on the connected
Supabase database, exactly as committed (a copy of
drizzle/migrations/0052_group_covers_and_socials.sql, safe to re-run). It
adds community_groups.cover_url with INSERT/UPDATE column grants for
authenticated, and profiles.social_youtube, social_snapchat and social_x.
Then regenerate the Supabase TypeScript types and confirm the app builds.
```

---

## Prompt 1 — phone push notifications (optional)

```
Please set up web push notifications for RevMate:

1. Run sql-to-run/13_push_notifications.sql on the connected Supabase
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
5. Run sql-to-run/14_push_setup_after_keys.sql, replacing
   <PUSH_WEBHOOK_SECRET> with the same value used in step 3.

Then confirm the send-push function returns a publicKey on a GET request.
```

---

When something has run, move it to the "Applied" section of
`PENDING_SQL.md` and its file into `sql-to-run/applied/` (or ask
Claude/Lovable to do it).
