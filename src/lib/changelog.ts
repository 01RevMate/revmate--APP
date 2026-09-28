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
    version: "1.10.0",
    date: "2026-09-28",
    title: "Safer sign-up, privacy & sharing",
    status: "needs_database_update",
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
    status: "needs_database_update",
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
    status: "needs_database_update",
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
    status: "needs_database_update",
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
    status: "needs_database_update",
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
    status: "needs_database_update",
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
