# Making money with RevMate: setup guide

Everything social stays free. Money comes from extras around the car, and
none of it ever appears in the social feed. All of it is managed in
**Admin → Money**, which appears once `sql-to-run/24_money.sql` has run.

| What | Who pays | Price to start | Where members see it |
|---|---|---|---|
| Featured advert | Sellers | £2.99 for 3 days, £4.99 for 7 | Their own advert page |
| RevMate Plus | Members who want to back the app | £2.99/month (founding members £1.49) | Settings, menu, `/plus` |
| Business Pro | Garages, detailers, traders | £19.99/month | Their business page (owner only) |
| Deals (affiliate links) | Partner companies, as commission | — | Essentials, EV chargers, fuel prices |
| Sponsored challenges | Brands | You agree a fee | One line on the weekly challenge |
| Shop (merch) | Members | You set prices | Menu and Settings |

Change any price in **Admin → Money → Prices**. A new price only applies to
new purchases.

---

## Step 1: run the SQL (no laptop needed)

Paste **Prompt A**, then **Prompt B**, from `LOVABLE_PENDING_SQL_PROMPT.md`
into Lovable. After that you can already use **Deals**, **Shop** and
**Sponsors**. Payments stay switched off.

## Step 2: affiliate deals (start earning without Stripe)

1. Join the affiliate programmes. Most UK car brands are on **Awin**
   (awin.com, free for publishers): Blackcircles, Euro Car Parts, Halfords,
   Ohme and many more. Also try **eBay Partner Network** and **Amazon
   Associates**. BookMyGarage runs its own scheme.
2. When a programme approves you, copy your tracking link.
3. Go to **Admin → Money → Deals**, edit the matching starter deal (or add
   one), paste the link and tick **Show it**.

Five starter deals are already there, switched off, pointing at the normal
websites. Don't switch one on until it has your tracking link, or you won't
earn anything. Avoid car finance and insurance deals for now: introducing
people to those can need FCA permission.

## Step 3: shop and sponsors

- **Shop:** set up a free print-on-demand shop (Teemill, Printful +
  Shopify, or Etsy) so there's no stock to buy. Paste the link in
  **Admin → Money → Shop**.
- **Sponsors:** agree a fee or a prize with a brand and invoice them
  directly. Then add their name in **Admin → Money → Sponsors** against
  that week's challenge.

## Step 4: card payments with Stripe (best done on a laptop)

1. Create an account at stripe.com and complete the business details.
2. In Stripe, go to **Developers → API keys** and copy the **secret key**.
   Use test mode (`sk_test_…`) first.
3. Ask Lovable:
   ```
   Please add the edge function secret STRIPE_SECRET_KEY = <my key>, and
   APP_URL = https://revmate.co.uk. Then deploy the edge functions in
   supabase/functions/create-checkout, supabase/functions/stripe-webhook
   and supabase/functions/billing-portal exactly as committed
   (supabase/config.toml already sets verify_jwt = false for
   stripe-webhook). Tell me the full URL of the stripe-webhook function.
   ```
4. In Stripe, go to **Developers → Webhooks → Add endpoint**:
   - URL: the stripe-webhook address Lovable gives you
   - Events: `checkout.session.completed`, `invoice.paid`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `charge.refunded`
5. Copy the endpoint's **signing secret** (`whsec_…`) and ask Lovable to add
   it as the edge function secret `STRIPE_WEBHOOK_SECRET`.
6. In Stripe, go to **Settings → Billing → Customer portal** and click
   **Save** once. This turns on the page members use to cancel or change
   their card.
7. In **Admin → Money → Overview**, click **Switch on**.
8. Test it: feature one of your own adverts using Stripe's test card
   `4242 4242 4242 4242` (any future date, any CVC). Check the advert is
   featured and the payment shows in **Admin → Money → Payments**.
9. When the test works, swap in your **live** secret key and a live
   webhook, repeating steps 3–5 with live values.

## Good to know

- **Tax:** income from the app is taxable. Register as self-employed with
  HMRC (or set up a limited company) once you start earning. VAT only
  applies once turnover passes the VAT threshold.
- **Refunds:** do these in the Stripe dashboard. The app marks the payment
  as refunded automatically.
- **Labels:** deals, promoted businesses and sponsored challenges are always
  labelled as ads or paid placements, as UK advertising rules (ASA/CMA)
  require. Keep it that way.
- **Plus members** never see deals, partner tiles or business ads.
- **Feed ads** from the ads manager only appear if you create a campaign
  with the "feed" placement. To keep the feed clean, use the Buy & Sell
  placement instead.
