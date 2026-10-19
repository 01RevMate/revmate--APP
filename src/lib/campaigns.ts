// Landing pages for TikTok posts and ads: revmate.co.uk/go/<campaign>.
// Each opens straight into a tool that works without an account, so people
// get something useful in one tap. Add ?utm_source=tiktok&utm_medium=paid
// to ad links (organic posts can use the bare link).

export type CampaignLink =
  "/fuel-prices" | "/ev-chargers" | "/sell" | "/meets" | "/marketplace" | "/cars" | "/signup";

export type Campaign = {
  slug: string;
  emoji: string;
  headline: string;
  sub: string;
  points: string[];
  cta: string;
  to: CampaignLink;
};

export const CAMPAIGNS: Campaign[] = [
  {
    slug: "fuel",
    emoji: "⛽",
    headline: "Cheapest fuel near you, right now",
    sub: "Live prices from UK forecourts, sorted by price. Free, no sign-up.",
    points: [
      "Petrol, diesel and premium",
      "Directions in Google Maps or Waze",
      "Search any town or postcode",
    ],
    cta: "Find cheap fuel",
    to: "/fuel-prices",
  },
  {
    slug: "ev",
    emoji: "⚡",
    headline: "Every EV charger near you, on one map",
    sub: "Connectors, speeds and directions. Ask other drivers if it's working.",
    points: ["Rapid and ultra-rapid filters", "List or map view", "Home charger guide"],
    cta: "Find a charger",
    to: "/ev-chargers",
  },
  {
    slug: "sell",
    emoji: "🚗",
    headline: "Sell your car free",
    sub: "List a car or parts in a couple of minutes. No fees, ever.",
    points: ["Free adverts", "Offers and messages in the app", "Seen by real UK car people"],
    cta: "Sell for free",
    to: "/sell",
  },
  {
    slug: "meets",
    emoji: "🏁",
    headline: "Car meets near you",
    sub: "Find meets and shows, see who's going and share your build.",
    points: ["Meets across the UK", "Reminders before they start", "Your garage, your builds"],
    cta: "See meets",
    to: "/meets",
  },
  {
    slug: "buy",
    emoji: "🔎",
    headline: "Cars and parts from real owners",
    sub: "Browse UK cars and parts for sale, with price-drop alerts.",
    points: ["Cars and parts", "Price-drop alerts", "Message sellers in the app"],
    cta: "Browse Buy & Sell",
    to: "/marketplace",
  },
  {
    slug: "faults",
    emoji: "🔧",
    headline: "Know your car's common faults",
    sub: "Real problems and fixes from owners of the same model.",
    points: ["Common faults by model", "Fixes that worked", "Ask owners for help"],
    cta: "Look up my car",
    to: "/cars",
  },
];

/** The link-in-bio page (and anything unknown) shows every campaign. */
export function findCampaign(slug: string): Campaign | null {
  return CAMPAIGNS.find((c) => c.slug === slug) ?? null;
}
