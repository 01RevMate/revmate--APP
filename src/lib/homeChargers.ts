import { supabase } from "@/integrations/supabase/client";

/** Information only — RevMate does not sell chargers. Keep summaries factual and general. */
export type HomeCharger = {
  slug: string;
  name: string;
  maker: string;
  madeIn: string;
  power: string;
  cable: string;
  priceGuide: string;
  bestFor: string;
  likes: string[];
  watchOuts: string[];
};

export const HOME_CHARGERS: HomeCharger[] = [
  {
    slug: "ohme-home-pro",
    name: "Home Pro",
    maker: "Ohme",
    madeIn: "UK",
    power: "7.4 kW",
    cable: "Tethered (built-in cable)",
    priceGuide: "Roughly £900–£1,100 fitted",
    bestFor: "Cheap overnight charging on smart tariffs",
    likes: [
      "Links with smart tariffs like Octopus Intelligent to charge at the cheapest times",
      "Built-in screen shows charge status without opening the app",
    ],
    watchOuts: ["Owners say the app can occasionally lose connection and need a restart"],
  },
  {
    slug: "myenergi-zappi",
    name: "zappi",
    maker: "myenergi",
    madeIn: "UK",
    power: "7 kW (22 kW three-phase version)",
    cable: "Tethered or socket",
    priceGuide: "Roughly £1,000–£1,300 fitted",
    bestFor: "Homes with solar panels",
    likes: [
      "Can charge the car using spare solar power instead of exporting it",
      "Popular with installers and widely supported",
    ],
    watchOuts: ["Larger unit and more settings to learn than simpler chargers"],
  },
  {
    slug: "hypervolt-home-3-pro",
    name: "Home 3 Pro",
    maker: "Hypervolt",
    madeIn: "UK",
    power: "7 kW",
    cable: "Tethered",
    priceGuide: "Roughly £850–£1,050 fitted",
    bestFor: "A tidy design with smart tariff and solar options",
    likes: ["Compact, clean look on the wall", "Supports smart tariffs and solar add-ons"],
    watchOuts: ["Some features need the app and a good Wi-Fi signal at the charger"],
  },
  {
    slug: "pod-point-solo-3",
    name: "Solo 3",
    maker: "Pod Point",
    madeIn: "UK",
    power: "7 kW",
    cable: "Tethered or socket",
    priceGuide: "Roughly £900–£1,100 fitted (often bundled with new cars)",
    bestFor: "A simple, well-known option",
    likes: ["Large national installer network", "Often offered through car dealers"],
    watchOuts: ["Fewer advanced smart features than some rivals"],
  },
  {
    slug: "easee-one",
    name: "One",
    maker: "Easee",
    madeIn: "Norway",
    power: "7.4 kW",
    cable: "Socket (use your own cable)",
    priceGuide: "Roughly £800–£1,000 fitted",
    bestFor: "A small, minimal charger",
    likes: ["Very compact", "Socket design keeps the wall tidy when not in use"],
    watchOuts: ["You need to keep a charging cable in the car or garage"],
  },
  {
    slug: "andersen-a2",
    name: "A2",
    maker: "Andersen",
    madeIn: "UK",
    power: "7 kW",
    cable: "Tethered, with wrap-around storage",
    priceGuide: "Roughly £1,200–£1,600 fitted",
    bestFor: "Premium looks on period or high-end homes",
    likes: ["Lots of finishes, including wood-effect panels", "Cable stores neatly inside"],
    watchOuts: ["One of the more expensive options"],
  },
  {
    slug: "wallbox-pulsar-max",
    name: "Pulsar Max",
    maker: "Wallbox",
    madeIn: "Spain",
    power: "7.4 kW",
    cable: "Tethered",
    priceGuide: "Roughly £750–£950 fitted",
    bestFor: "Keeping costs down",
    likes: ["Small and usually among the cheaper smart chargers"],
    watchOuts: ["Owner reviews of the app are mixed"],
  },
  {
    slug: "tesla-wall-connector",
    name: "Wall Connector",
    maker: "Tesla",
    madeIn: "USA",
    power: "7 kW (single-phase UK homes)",
    cable: "Tethered (Type 2)",
    priceGuide: "Roughly £800–£1,000 fitted",
    bestFor: "Tesla owners, though it works with any Type 2 car",
    likes: ["Slim design and long cable", "Simple to live with"],
    watchOuts: ["Fewer smart tariff features for non-Tesla cars"],
  },
];

export const HOME_CHARGER_FAQ: { q: string; a: string }[] = [
  {
    q: "How much does a home EV charger cost?",
    a: "Most UK home chargers cost roughly £800–£1,200 including a standard install. Long cable runs, a new fuse box or ground work can add to that, so get a quote from an approved installer.",
  },
  {
    q: "Is there a government grant?",
    a: "The UK EV chargepoint grant is now aimed at people who rent or live in flats, rather than homeowners with a driveway. Check gov.uk for the latest rules before booking.",
  },
  {
    q: "How long does it take to charge at home?",
    a: "A 7 kW home charger adds roughly 25–30 miles of range per hour, so most cars fill up overnight.",
  },
  {
    q: "Do I need off-street parking?",
    a: "In practice, yes — trailing cables across a pavement isn't allowed in many areas. Without a driveway, look at local on-street and rapid chargers on our map instead.",
  },
  {
    q: "What is a smart charger?",
    a: "Since 2022, new UK home chargers must be 'smart', meaning they can schedule charging. Paired with an off-peak EV tariff, that can make home charging much cheaper than public charging.",
  },
];

export type HomeChargerReview = {
  id: string;
  charger_slug: string;
  user_id: string;
  rating: number;
  body: string;
  created_at: string;
  username: string | null;
};

export async function fetchHomeChargerReviews(): Promise<HomeChargerReview[]> {
  const { data, error } = await supabase
    .from("home_charger_reviews")
    .select("id, charger_slug, user_id, rating, body, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", ids);
    for (const p of profs ?? []) if (p.username) names.set(p.user_id, p.username);
  }
  return rows.map((r) => ({ ...r, username: names.get(r.user_id) ?? null }));
}

export async function saveHomeChargerReview(
  userId: string,
  slug: string,
  rating: number,
  body: string,
) {
  const { error } = await supabase
    .from("home_charger_reviews")
    .upsert(
      { charger_slug: slug, user_id: userId, rating, body: body.trim() },
      { onConflict: "charger_slug,user_id" },
    );
  if (error) throw error;
}
