# Lovable prompts — run outstanding RevMate SQL

Steps 1–12 in `sql-to-run/` have all been applied (the latest, 8–12, on 28
September 2026). Steps 15 (live unread badge), 16 (Speakers / Sound
diagnostics), 17 (Buy & Sell upgrade), 18 (group covers + more social
links) and 19 (public profile pages) were applied on 1–2 October 2026, and
steps 20 (remove location from posts — found already applied by hand) and
21 (security fixes) on 5 October 2026. Step 22 (group icons) has also run. Left to do: step 23 (launch kit), step 24
(money), step 25 (campaigns), step 26 (diagnosis & shops), steps 27–29 (store, auctions, feed & badges)
and the optional phone notifications setup.

---

## Prompt A — launch kit (feedback, launch stats, Founding member badges)

```
Please run sql-to-run/23_launch_kit.sql on the connected Supabase database,
exactly as committed. Don't change it; it's safe to re-run. It adds:
- an app_feedback table (members insert, only admins read/update/delete),
- public.founding_members (badge numbers 1-100) plus a private counter, and
  a trigger on public.profiles that hands out numbers to new sign-ups,
- public.founding_spots_left() (callable by anyone) and
  public.admin_launch_stats() (admins only).
Then regenerate the Supabase types and confirm that
SELECT public.founding_spots_left(); returns a number.
```

---

## Prompt B — money (run after Prompt A)

```
Please run sql-to-run/24_money.sql on the connected Supabase database,
exactly as committed. Don't change it; it's safe to re-run. It adds
app_settings, paid_products, payments, subscriptions, billing_customers and
affiliate_deals tables, a promoted_until column on businesses, sponsor
columns on challenges, and service-role-only billing_* functions.
Then regenerate the Supabase types and confirm that
SELECT key, value FROM public.app_settings; returns payments_enabled = false.
Don't deploy the payment edge functions or add Stripe secrets yet — I'll do
that separately once my Stripe account is ready.
```

---

## Prompt C — campaigns (run after Prompt B)

```
Please run sql-to-run/25_campaigns.sql on the connected Supabase database,
exactly as committed. Don't change it; it's safe to re-run. It adds a
campaign_visits table (daily counts only), a signup_sources table filled by a
trigger on public.profiles, public.record_campaign_visit() (callable by
anyone), the admin-only public.admin_campaign_stats(), and three empty
app_settings rows. Then regenerate the Supabase types.
```

---

## Prompt D — AI diagnosis limits & Shops (run after Prompt C)

```
Please run sql-to-run/26_diagnosis_and_shops.sql on the connected Supabase
database, exactly as committed. Don't change it; it's safe to re-run. It adds
ai_usage with a service-role-only ai_take_credit() function, the admin-only
admin_ai_usage(), shops and shop_products tables with their policies and
triggers, record_shop_click(), and three app_settings rows. Then regenerate
the Supabase types.
```

---

## Prompt E — store (run after Prompt D)

```
Please run sql-to-run/27_store.sql on the connected Supabase database, exactly as
committed. Don't change it; it's safe to re-run. It adds: RevMate Store (products, suppliers, orders) + new notification kinds.
Then regenerate the Supabase types.
```

---

## Prompt F — auctions (run after Prompt E)

```
Please run sql-to-run/28_auctions.sql on the connected Supabase database, exactly as
committed. Don't change it; it's safe to re-run. It adds: Auctions on Buy & Sell (bids, hidden reserve, anti-sniping).
Then regenerate the Supabase types.
```

---

## Prompt G — feed & badges (run after Prompt F)

```
Please run sql-to-run/29_feed_and_badges.sql on the connected Supabase database, exactly as
committed. Don't change it; it's safe to re-run. It adds: Fresher For You feed (seen posts) + badges.
Then regenerate the Supabase types.
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
