// RevMate release history — the single source of truth for the App updates
// page (/legal/updates) and the machine-readable feed (/updates.json).
//
// When you ship a user-facing change: add it to the newest release (or start
// a new one at the top), bump APP_VERSION to match, and set `status`.
// Newest release first.

export type ReleaseStatus =
  /** Everything in this release is live for everyone. */
  | "live"
  /** Code is shipped but some features wait on a database update (see PENDING_SQL.md). */
  | "needs_database_update";

export type Release = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  status: ReleaseStatus;
  highlights: string[];
  fixes?: string[];
  /** Migrations this release needs, in run order (paths in the repo). */
  requiredSql?: string[];
};

export const RELEASES: Release[] = [
  {
    version: "1.14.0",
    date: "2026-10-01",
    title: "A better Buy & Sell",
    status: "live",
    highlights: [
      "Save a search and get alerts when a new listing matches, or when one drops into your budget",
      "Search near you: enter your postcode, pick 10–100 miles, and see how far away each listing is",
      "Make an offer: sellers can accept, decline or come back with a price, and you're told at each step",
      "Price guide on cars: Good, Fair or Higher price compared with similar cars on RevMate (only when there are enough to compare)",
      "Parts get categories, condition (new, used, refurbished), photos and postage or collection",
      '"Fits your car" badge on parts that match a car in your garage',
      "Seller trust: member since, how quickly they usually reply, items sold, and reviews from real buyers",
      "After selling through RevMate, pick who bought it and they can leave you a review",
      "Compare up to three cars side by side",
      "Similar listings on every advert, plus running costs (MPG, CO₂, insurance group) and a road tax link",
      "Photo guide and an advert quality score when you sell",
      "MOT history link to GOV.UK on every car, with registration lookup and in-app MOT history coming soon",
      "Meet covers: upload a photo, reuse one from a past meet, or pick a RevMate design. Organisers can change it any time, and meets without one get a matching design automatically",
      "Groups can have a cover image: add one when you create a group, or change it in group settings",
      "Social links got a glow-up: brand-coloured buttons with your @handle on your profile, and you can just type your username to add them. YouTube, Snapchat and X added",
      "A clearer \"Your area\" section in Edit profile and Settings: it explains what it's for, and that it's never shown to anyone",
      'Your area now shows how far car meets are, sorts meets nearest first, and fills in your advert location and "near me" on Buy & Sell',
    ],
    requiredSql: [
      "drizzle/migrations/0051_marketplace_upgrade.sql",
      "drizzle/migrations/0052_group_covers_and_socials.sql",
    ],
  },
  {
    version: "1.13.0",
    date: "2026-09-28",
    title: "Car care, smart diagnostics, search & local businesses",
    status: "live",
    highlights: [
      "MOT and road tax reminders: add the dates to your car and get reminders 30, 7 and 1 day before, with GOV.UK links and add-to-calendar",
      "Diagnostic posts ask which part of the car the problem is in, and the author can mark it fixed with one tap and say what fixed it",
      "When a problem is fixed, everyone who liked or commented is told; authors get a nudge if they haven't updated it",
      "Known issues on every car page, plus a Problems & fixes page to find faults other owners have fixed",
      "Search now works: people, cars, posts, listings, groups, hashtags and businesses",
      "Tag the car a post is about by make, model, engine and year, perfect for asking what a car is like to own",
      "Hashtags light up as you type, with popular tags suggested like on TikTok",
      "A smarter For You feed that learns what you're into from your cars (brand, EV, modified or standard) and what you like",
      "Local businesses: mechanics, bodywork, EV installers, detailers and dealers, rated and reviewed by members, with trust badges and reporting",
      "Admin ads manager for local sponsored posts targeted by area and car type, always labelled Sponsored",
      "Set your area in Settings for local offers (only you can see it)",
      "Diagnostic posts have a new Speakers / Sound option for audio faults",
      "Unread messages now show as a red number on Messages in the bottom bar, the menu button and the menu, and update live",
    ],
    fixes: [
      "Diagnostic posts now keep their category in the standard header position, with status, problem type and selected car grouped neatly below",
      "Message threads now fit phone screens without page-level scrolling, keeping the chat header and composer visible while messages scroll independently",
    ],
    requiredSql: [
      "drizzle/migrations/0045_car_care_diagnostics_feed.sql",
      "drizzle/migrations/0046_businesses_and_ads.sql",
      "drizzle/migrations/0047_live_messages.sql",
      "drizzle/migrations/0048_diagnostics_audio_category.sql",
    ],
  },
  {
    version: "1.12.0",
    date: "2026-09-28",
    title: "Smoother videos, car specs & RevMate News",
    status: "live",
    highlights: [
      "Reactions now work properly on phones: hold the heart without the page trying to select or copy, or tap the like count to pick a reaction",
      "Videos in the feed play silently on their own as you scroll, one at a time, with a slim progress bar and a sound button",
      "Tap a video for a full-screen player with sound, a seek bar and tap-to-pause",
      "Car adverts get an Overview card with icons for the key details (mileage, year, fuel, body, gearbox, engine, doors, seats) and a View all details button for owners, MOT, service history, ULEZ and more",
      "Buy & Sell filters for make, model, year, mileage, gearbox, fuel, body type, seller and ULEZ, plus sorting by mileage or age",
      "A 'Before you buy' checklist on every car advert, with a link to the free GOV.UK MOT history check",
      "RevMate News: official posts from the RevMate team in your feed, covering app updates, news, fuel prices and partner offers",
    ],
    fixes: ["Opening the admin page directly by its web address now works for admins"],
    requiredSql: [
      "drizzle/migrations/0043_listing_details.sql",
      "drizzle/migrations/0044_revmate_news.sql",
    ],
  },
  {
    version: "1.11.0",
    date: "2026-09-28",
    title: "Announcements",
    status: "live",
    highlights: [
      "Pop-up announcements when you open the app, so you never miss what's new",
      "Each announcement shows once, and can have a picture and a button",
      "Admins can start from the latest update or write their own, pick who sees it (everyone, 18+ or under 18s) and schedule start and end times",
      "Admins see how many people saw each announcement and tapped its button",
    ],
    requiredSql: ["drizzle/migrations/0042_announcements.sql"],
  },
  {
    version: "1.10.0",
    date: "2026-09-28",
    title: "Safer sign-up, privacy & sharing",
    status: "live",
    highlights: [
      "New step-by-step sign-up: birthday, email and password, username, then agreeing to the Terms and Privacy Policy (marketing emails are optional and unticked)",
      "RevMate is for people 13 and over; under-13 sign-ups are refused",
      "Teen protections: selling on Buy & Sell, hosting meets and adding a location to posts unlock at 18, and direct messages at 16",
      "Existing members are asked once to confirm their date of birth and agree to the updated terms",
      "Settings → Privacy & your data: download your data, change marketing emails, or permanently delete your account",
      "Rewritten Terms and Privacy Policy, plus new Cookie Policy and Safety & Reporting pages",
      "Maps on meets only load from Google when you tap Show map",
      "Shared links now show rich previews with photos: listings show the price and car, and posts, profiles, cars, groups and meets show their own details",
      "Better Google results: product details on listings, a sitemap, canonical links, and private pages kept out of search",
      "Extra security headers on every page",
    ],
    requiredSql: ["drizzle/migrations/0037_age_and_consent.sql"],
  },
  {
    version: "1.9.0",
    date: "2026-09-28",
    title: "Group entry rules",
    status: "live",
    highlights: [
      "When making a group, choose who can join: everyone, owners of one brand, or owners of one exact car",
      "Brand and car groups check your garage when you tap join, and tell you what car you need if you don't have it",
      "In brand and car groups you can only post as a matching car from your garage",
      "New 'No sales or advertising' setting blocks for-sale posts and listing links in a group",
      "Group rules people must agree to, plus entry questions (rules to agree to, yes/no with a required answer, or written answers)",
      "Moderators see each person's answers with their join request",
      "Owners can change the make, model, entry rule, joining, sales setting, rules and questions at any time",
    ],
    requiredSql: ["drizzle/migrations/0036_group_rules.sql"],
  },
  {
    version: "1.8.1",
    date: "2026-09-28",
    title: "Join to unlock",
    status: "live",
    highlights: [
      "Without an account you can browse the feed and Buy & Sell; everything else shows a free sign-up screen",
      "Liking, commenting, stories, saving, watching and messaging sellers all ask you to join first",
      "After signing up or logging in you land straight back on what you were trying to open",
    ],
  },
  {
    version: "1.8.0",
    date: "2026-09-28",
    title: "Marketplace upgrade",
    status: "live",
    highlights: [
      "Buy & Sell redesigned as a photo grid (4 across on desktop, 2 on phones) with the price front and centre",
      "Search, price-range filters and sorting (newest, cheapest, most expensive, most watched)",
      "'New today' and 'new since your last visit' so fresh listings stand out",
      "Pick up where you left off: listings you recently looked at",
      "Watchlist: tap the heart to watch a listing and get an alert if the price drops",
      "Price drops show the old price crossed out and how much you save",
      "Sellers can change their price from Manage advert",
      "View and watcher counts on listings",
      "Featured listings pinned to the top, set by admins",
      "Sponsored partner tiles and banners, run from Admin → Partners, with click counts",
      "Sellers can add their town so buyers can find things nearby",
    ],
    requiredSql: ["drizzle/migrations/0035_marketplace.sql"],
  },
  {
    version: "1.7.0",
    date: "2026-09-27",
    title: "Essentials",
    status: "live",
    highlights: [
      "New Essentials home for the practical side of RevMate: buy a car, buy parts, sell, get help, research cars",
      "Switch between Community and Essentials at the top of Home or in Settings",
      "The first-run setup asks what you'll use RevMate for, and starts you on Essentials if you're not here for the community side",
      "Buy & Sell can now be filtered to just cars or just parts",
      "Space ready for fuel prices, EV chargers, MOT & tax reminders and a running cost calculator (coming soon)",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-09-27",
    title: "Engagement pack",
    status: "live",
    highlights: [
      "For You feed, ranked around the makes you like and the people you follow",
      "Pick your favourite makes and people to follow when you join",
      "Car Battles: tap the car you'd rather have — the weekly winner is crowned Car of the Week",
      "Revs: a full-screen video feed you swipe through",
      "Pit Stops: photos and clips that disappear after 24 hours",
      "Weekly recap and alerts when your car climbs the leaderboard",
      "Daily streaks and levels, from Learner to Legend",
      "Weekly challenges like #StanceSunday, with winners picked by admins",
      "Near you: meets and posts from your area",
      "Press and hold the like button to react with 🔥 😍 🤯 😂",
      "A 'new posts' button when fresh posts arrive while you scroll",
      "Share cards for Instagram and TikTok showing your car's UK rank",
      "Notifications are bundled, with quiet hours and per-type muting in Settings",
    ],
    requiredSql: ["drizzle/migrations/0033_engagement.sql"],
  },
  {
    version: "1.5.0",
    date: "2026-09-27",
    title: "Social pack",
    status: "live",
    highlights: [
      "Car meets & events: post a meet, RSVP Going or Interested, see who's coming, get directions, add it to your calendar and get a reminder the day before",
      "Reply to comments and like them",
      "@mention people in posts and comments — they get notified",
      "#hashtags link to a page of every post with that tag",
      "Video posts (MP4, MOV or WebM up to 50MB)",
      "Save posts and find them under Saved on your profile",
      "Repost to your followers with your own caption",
      "Polls with two to four options",
      "Spotted: post a car you saw out and about and link the owner's garage car",
      "Build timeline on every car page",
      "Verified badges for clubs, traders and creators",
      "Phone push notifications (switch on in Settings)",
      "Share button opens your phone's share sheet",
    ],
    fixes: ["Marking a car as sold works even before the removal-reason database update"],
    requiredSql: [
      "drizzle/migrations/0031_social_features.sql",
      "drizzle/migrations/0032_push_notifications.sql",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-09-27",
    title: "Garage tidy-up and launch screen",
    status: "live",
    highlights: [
      "Removing a car asks what happened to it — sold, for sale, scrapped, written off or other",
      "New launch screen with the RevMate logo and a loading bar",
    ],
    fixes: ["Liking a showcase post now counts once across the whole app, wherever you see it"],
    requiredSql: ["drizzle/migrations/0030_garage_car_ownership_end_reason.sql"],
  },
  {
    version: "1.3.0",
    date: "2026-09-25",
    title: "Followers, marketplace and sellers",
    status: "live",
    highlights: [
      "Follow people instead of friend requests, with Account Stats for your profile",
      "Full listing pages for cars for sale, with multi-photo uploads and an ad headline",
      "Manage your adverts and message sellers from a listing",
      "Seller achievements, seller score and report-a-seller",
      "Showcase posts get like and dislike votes that feed the car leaderboard",
    ],
    fixes: [
      "Duplicate marketplace submissions are prevented",
      "For-sale posts stay in sync with the feed",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-24",
    title: "Car rankings",
    status: "live",
    highlights: [
      "Like, dislike and follow individual garage cars",
      "Car leaderboard by overall, brand and model",
      "Sell a car straight from your garage",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-09-23",
    title: "Messaging and a better feed",
    status: "live",
    highlights: [
      "Private messages with photos and read receipts",
      "Immersive full-width feed on phones, with swipeable photos",
      "Choose a post's category after tapping Post",
      "Profile cars shown as a garage",
      "In-app notifications for likes, comments, follows and more",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-22",
    title: "Community launch",
    status: "live",
    highlights: [
      "Groups with public or private membership",
      "Followers-only posts",
      "Full-screen photo viewer",
      "Only approved vehicle makes can be added to garages",
      "Content safety: reporting, blocking and admin moderation",
    ],
  },
];

export const APP_VERSION = RELEASES[0]!.version;
export const LATEST_RELEASE = RELEASES[0]!;

/** The machine-readable shape served at /updates.json. */
export function changelogFeed() {
  return {
    app: "RevMate",
    latest_version: APP_VERSION,
    latest_release_date: LATEST_RELEASE.date,
    latest_status: LATEST_RELEASE.status,
    human_readable_url: "/legal/updates",
    notes:
      "Releases are newest first. status 'needs_database_update' means the code is shipped but the listed requiredSql has not necessarily been run yet; see PENDING_SQL.md in the repository.",
    releases: RELEASES,
  };
}
