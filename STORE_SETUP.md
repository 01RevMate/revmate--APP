# RevMate Store: setup guide

The RevMate Store is RevMate's own shop, like Amazon for car stuff. People
add items to a basket, pay by card, and the item is delivered to their door.
RevMate is the seller. Each product is sent one of three ways:

| "Sent by" | What it means | When to use it |
|---|---|---|
| **Drop-ship supplier** | When an order comes in, you buy the item from the supplier and have it sent straight to the customer | Starting out: no stock, no risk |
| **UK partner** | A UK brand or wholesaler you've agreed a deal with sends it | Once you've got partnerships (better margins, faster delivery) |
| **RevMate** | You hold the stock and post it yourself | Your own merch, or best-sellers |

## How an order works

1. The customer pays. Stripe takes the payment, and the order appears in
   **Admin → Store → Orders → To send**, with the delivery address and an
   **"Order from …"** link to each item's supplier page.
2. You place the order with the supplier or partner, sending it to the
   customer's address. Set the order to **Being prepared** and add the
   supplier's order number as a private note.
3. When it ships, add the carrier, tracking number and tracking link, then
   set it to **On its way**. The customer gets a notification and sees
   tracking in **My orders**.
4. Set it to **Delivered** when it arrives. Refunds are done in Stripe, and
   the order is marked refunded automatically.

Every status change notifies the customer.

## Setting it up

1. Run SQL step 27 (it's in the master prompt).
2. Set up Stripe and switch payments on. See `MONETISATION_SETUP.md`, step 4.
3. Ask Lovable to deploy `supabase/functions/store-checkout` and to redeploy
   `supabase/functions/stripe-webhook`, both exactly as committed.
4. In **Admin → Store → Products**, add products: photos (image links),
   price, delivery charge and time, and the private supplier details (name,
   where to order it, your cost price; the form shows your margin).
5. In **Admin → Store → Settings**, set the free-delivery threshold (default
   £50) and tap **Open store**.

## Finding products and suppliers

- **UK drop-ship and wholesale suppliers** for car care, air fresheners and
  accessories: look for UK wholesalers with drop-ship options. Ask for
  trade pricing, UK stock and 1–3 day delivery.
- **Partnerships:** contact small UK makers (detailing brands, air freshener
  makers, sticker and merch shops). Offer them a featured spot in the Store,
  where they post the order and you take a margin. The Shops directory
  (`/shops`) is a good place to find and approach them.
- Start with **10–20 products** that sell themselves to car people: snow
  foam, microfibre towels, air fresheners, phone mounts, dash cams, valve
  caps, number plate surrounds, and RevMate stickers.

## Rules to stick to

- As the seller, you owe customers UK consumer rights: a 14-day change-of-mind
  return, and refund, repair or replacement for faulty items. The terms page
  already says this.
- Don't sell anything illegal or unsafe for road use (for example tinted
  front windows beyond the legal limit, or certain lighting).
- Keep a record of every order. They stay in the database, and Stripe keeps
  receipts.
- Register for VAT once your turnover passes the VAT threshold.
