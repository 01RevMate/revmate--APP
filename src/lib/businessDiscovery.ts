import { useQuery } from "@tanstack/react-query";
import { looseDb } from "@/lib/looseDb";

/**
 * Searching for businesses as an ordinary member (migration 0082). Anyone can search; no business
 * account is needed. Off until the database reports it is installed; the directory then keeps its
 * earlier read-only search.
 */
export function useBusinessDiscovery(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "business-discovery"],
    queryFn: async () => {
      try {
        const { data, error } = await looseDb.rpc("business_discovery_ready");
        return !error && data === true;
      } catch {
        return false;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data === true;
}

export type DiscoveryFilters = {
  q?: string | undefined;
  /** Tapped "what do you need" shortcut: an exact category filter. */
  need?: string | undefined;
  area?: string | undefined;
  scope?: "local" | "national" | "any" | undefined;
  minRating?: number | undefined;
  trusted?: boolean | undefined;
  openNow?: boolean | undefined;
  sort?: "best" | "rating" | undefined;
};

export type DiscoveryResult = {
  id: string;
  name: string;
  category: string;
  description: string;
  town: string | null;
  postcode_district: string | null;
  address: string | null;
  logo_url: string | null;
  verified: boolean;
  rating_avg: number;
  reviews_count: number;
  rating_score: number;
  trust_level: "new" | "trusted" | "caution";
  serves_nationwide: boolean;
  promoted: boolean;
  match_tier: number;
  opening_hours: Record<string, { open: string; close: string } | null> | null;
  services: string[];
  total_count: number;
};

/** "What do you need?" shortcuts: each is an exact set of categories. */
export const NEEDS: { id: string; label: string; emoji: string; categories: string[] }[] = [
  { id: "mot", label: "MOT", emoji: "📋", categories: ["mot_centre"] },
  {
    id: "service",
    label: "Service & repairs",
    emoji: "🔧",
    categories: [
      "garage",
      "mobile_mechanic",
      "specialist",
      "diagnostics",
      "auto_electrician",
      "air_con",
      "exhaust_centre",
      "clutch_gearbox",
    ],
  },
  { id: "tyres", label: "Tyres", emoji: "🛞", categories: ["tyres", "alignment"] },
  {
    id: "body",
    label: "Bodywork & dents",
    emoji: "🎨",
    categories: ["bodywork", "smart_repair", "windscreen"],
  },
  { id: "detail", label: "Detailing & wash", emoji: "✨", categories: ["detailing", "car_wash"] },
  { id: "wheels", label: "Alloys & wheels", emoji: "⚙️", categories: ["wheel_refurb", "tyres"] },
  { id: "wraps", label: "Wraps & protection", emoji: "🛡️", categories: ["wraps"] },
  {
    id: "tuning",
    label: "Tuning & performance",
    emoji: "🏁",
    categories: ["tuning", "motorsport", "restoration"],
  },
  { id: "parts", label: "Parts", emoji: "🔩", categories: ["parts", "breakers", "accessories"] },
  {
    id: "ev",
    label: "Electric",
    emoji: "⚡",
    categories: ["ev_charger_installer", "ev_specialist"],
  },
  { id: "recovery", label: "Recovery", emoji: "🚛", categories: ["recovery"] },
  {
    id: "buy",
    label: "Buy a car",
    emoji: "🚘",
    categories: [
      "dealer",
      "franchise_dealer",
      "prestige_dealer",
      "van_dealer",
      "motorbike_dealer",
      "car_buying",
    ],
  },
];

/** Words people type, mapped to categories so "mot" or "dent" finds the right kind of business. */
const WORDS: [RegExp, string[]][] = [
  [/\bmot\b/i, ["mot_centre"]],
  [
    /\b(service|servicing|repair|mechanic|garage|brakes?|clutch|gearbox)\b/i,
    ["garage", "mobile_mechanic", "specialist", "clutch_gearbox"],
  ],
  [/\b(tyres?|tires?)\b/i, ["tyres"]],
  [/\b(dents?|scratch|paint|body ?shop|bodywork)\b/i, ["bodywork", "smart_repair"]],
  [/\b(windscreen|glass)\b/i, ["windscreen"]],
  [/\b(wrap|ppf|ceramic)\b/i, ["wraps"]],
  [/\b(detail|valet|wash|polish)\w*/i, ["detailing", "car_wash"]],
  [/\b(alloy|alloys|wheel|wheels|refurb)\b/i, ["wheel_refurb", "tyres"]],
  [/\b(remap|tune|tuning|dyno|performance)\b/i, ["tuning", "motorsport"]],
  [/\b(parts?|breakers?|spares?)\b/i, ["parts", "breakers", "accessories"]],
  [/\b(ev|electric|charger|charging)\b/i, ["ev_charger_installer", "ev_specialist"]],
  [/\b(recovery|breakdown|tow)\b/i, ["recovery"]],
  [/\b(dealer|dealership|buy|sell)\b/i, ["dealer", "franchise_dealer", "prestige_dealer"]],
];

export function intentCategories(query: string): string[] {
  const found = new Set<string>();
  for (const [pattern, categories] of WORDS)
    if (pattern.test(query)) categories.forEach((c) => found.add(c));
  return [...found];
}

export const MATCH_LABELS: Record<number, string> = {
  0: "In your area",
  1: "Nearby",
  2: "Covers your area",
  3: "In your town",
  4: "Nationwide",
};

export async function searchBusinesses(
  f: DiscoveryFilters,
  offset: number,
  limit = 24,
): Promise<DiscoveryResult[]> {
  const need = NEEDS.find((n) => n.id === f.need);
  const q = f.q?.trim() || null;
  const { data, error } = await looseDb.rpc("search_businesses", {
    p_query: q,
    p_categories: need ? need.categories : null,
    p_area: f.area?.trim() || null,
    p_scope: f.scope ?? (f.area?.trim() ? "local" : "any"),
    p_min_rating: f.minRating ?? 0,
    p_trusted_only: !!f.trusted,
    p_open_now: !!f.openNow,
    p_sort: f.sort ?? "best",
    p_limit: limit,
    p_offset: offset,
    p_intent: q ? intentCategories(q) : null,
  });
  if (error) throw new Error(error.message);
  return (data as DiscoveryResult[] | null) ?? [];
}
