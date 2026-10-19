# TikTok Pixel: notes for when you're ready

## What's already built

- **Where the ID goes:** Admin → Marketing → TikTok Pixel. It's saved in
  `app_settings.tiktok_pixel_id` and needs SQL steps 24 and 25 to have run.
- **Consent first:** once an ID is saved, visitors are asked "Can we use
  TikTok ad cookies?" with **No thanks** and **Allow**. The pixel only loads
  after **Allow**, as UK PECR requires.
- **Never for under-18s:** the pixel doesn't run for signed-in accounts
  under 18, and the sign-up event isn't sent for under-18s.
- **Events sent:**
  - `PageView`: every page change.
  - `ViewContent`: on `/go/<campaign>` landing pages, with the campaign as
    `content_id`.
  - `CompleteRegistration`: when an adult signs up.
- **Changing your mind:** people can change their answer in Settings →
  Privacy, or on the Cookie policy page if signed out.
- **Code:**
  - `src/lib/tiktokPixel.ts`: TikTok's official base code, consent and
    events.
  - `src/components/AdsConsent.tsx`: the consent question and the Settings
    toggle.
  - `src/components/AdminMarketing.tsx`: where admins paste the ID.

## Getting the Pixel ID (TikTok Ads Manager, works on a phone)

1. Sign in at ads.tiktok.com and create an ads account (UK, GBP).
2. Go to **Tools → Events → Web events → Set up web events**.
3. Name it "RevMate" and choose **TikTok Pixel**, then **Manually install
   pixel code**.
4. Copy the **Pixel ID**: the letters and numbers that look like
   `C4ABCDEF1234567890`. You don't need the code itself; RevMate already
   has it.
5. Paste the ID into **Admin → Marketing → TikTok Pixel → Save**.
6. Back in TikTok, use **Test events** (or the TikTok Pixel Helper Chrome
   extension) on `revmate.co.uk/go/fuel`, tap **Allow**, and check a
   PageView arrives.

## Setting up ads

- **Objective:** Website conversions, optimised for
  **CompleteRegistration**. Use Traffic until you have about 50 sign-ups
  from ads.
- **Website URL:** copy the "Ad link" from Admin → Marketing. It already has
  `?utm_source=tiktok&utm_medium=paid&utm_campaign=…`.
- **Audience:** UK, **18+**.
- **Budget:** start at £5–10 a day per ad. Compare landing pages in
  Admin → Marketing → "What's working", then back the winners.
- Because the pixel only counts people who tap Allow, TikTok's numbers will
  look lower than reality. The Admin → Marketing counts include everyone.

## Later (optional)

- **TikTok Events API:** sends sign-ups from the server, so they're counted
  even for people who block the pixel. It would need a TikTok access token
  stored as an edge function secret and a small edge function. Ask Claude
  when you want it.
