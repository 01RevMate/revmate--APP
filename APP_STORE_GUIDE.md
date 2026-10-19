# TikTok, and getting RevMate into the app stores

## Being a web app is fine for TikTok

For TikTok ads, a web app is actually an advantage. Someone taps your ad and
lands straight in RevMate, inside TikTok, in one tap. There's no "go to the
store, download, open, sign up" in the middle, which is where most app ads
lose people.

What's already built for this:

- **Landing pages**: `revmate.co.uk/go/fuel`, `/go/ev`, `/go/sell`,
  `/go/meets`, `/go/buy` and `/go/faults` each open straight into a tool that
  works without an account. `/go/tiktok` is your link-in-bio page.
- **TikTok's built-in browser**: RevMate works in it. Visitors get a tip
  explaining how to open it in their real browser to install it, and the
  install pop-up explains the same instead of failing.
- **Campaign tracking**: Admin → Marketing shows visits and sign-ups per
  campaign. Ad links carry `?utm_source=tiktok&utm_medium=paid`, and the
  Marketing tab copies them for you.
- **TikTok Pixel**: paste your Pixel ID in Admin → Marketing. Visitors are
  asked first, and it only runs for people who tap Allow (never for under-18
  accounts). It records page views, landing-page views and sign-ups
  (`CompleteRegistration`), so TikTok can optimise your ads for sign-ups.

### Before you spend money on ads

1. Run SQL steps 23–25 (ask Claude for the master prompt).
2. In TikTok Ads Manager, create the Pixel and paste its ID into Admin →
   Marketing.
3. Target **18+ in the UK**. TikTok's audience is young and RevMate limits
   what under-18s can do.
4. Use a **Website / Traffic** or **Website conversions** objective (not
   "App"), with your ad link from Admin → Marketing.
5. Check your database plan can take a spike. Lovable Cloud scales with
   usage, but keep an eye on its usage page the first few days.
6. Start small (£5–10 a day per ad), see which landing page gets sign-ups in
   Admin → Marketing, then put money behind the winners.

## Google Play (do this first — cheap and quick)

RevMate can go on Google Play as a **Trusted Web Activity**: a real Play
Store app that opens the website full-screen. No rewrite, and updates still
come from Lovable.

1. Create a Google Play developer account (play.google.com/console), a
   one-off $25. New personal accounts must run a **closed test with at least
   12 testers for 14 days** before going public, so line up friends early.
2. Go to **pwabuilder.com**, enter `https://revmate.co.uk` and choose
   **Package for stores → Android**. Download the package (it includes the
   signing key — keep it safe).
3. Upload the `.aab` file to Play Console. Add screenshots, a description,
   the privacy policy link (`/legal/privacy`) and the content rating
   questionnaire.
4. Copy the **package name** and **SHA-256 fingerprint** (from PWABuilder,
   or Play Console → App integrity → App signing) into **Admin → Marketing →
   Android app**. RevMate then serves `/.well-known/assetlinks.json`
   automatically, which removes the browser bar from the app.

## Apple App Store (later)

- It needs a Mac (or a paid cloud Mac) to build, and costs $99 a year.
- Apple often rejects apps that are "just a website" (guideline 4.2).
  RevMate has a better chance than most because it does a lot, but a proper
  native wrapper (for example Capacitor) with push notifications is the safe
  route.
- Apple requires in-app purchase for digital subscriptions bought inside the
  app, which means RevMate Plus. The usual approach is to hide Plus in the
  iOS app and let people join on the website.

Until then, iPhone users install RevMate from Safari (Share → Add to Home
Screen). The app already shows those steps.
