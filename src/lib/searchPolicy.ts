// Search uses the ordinary member/visitor client. Never bypass RLS to fill results.
export function cleanSearchQuery(query: string): string {
  return query.slice(0, 100).trim().replace(/[%_,()*\\"']/g, " ").replace(/\s+/g, " ").trim();
}

export function memberSearchAllowed(memberId: string | null): boolean {
  return typeof memberId === "string" && memberId.length > 0;
}

export async function settleSearch<T>(
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; unavailable: boolean }> {
  try {
    const { data, error } = await run();
    return error ? { rows: [], unavailable: true } : { rows: data ?? [], unavailable: false };
  } catch {
    return { rows: [], unavailable: true };
  }
}

// These are destinations, not a host directory. Home addresses, host areas and
// coordinates must only be obtained through Lendawatt's existing opt-in flow.
export const SEARCH_TOOLS = [
  { id: "public-chargers", title: "EV chargers", detail: "Public charging map", to: "/ev-chargers", kind: "chargers", keywords: "ev electric charging charge charger chargers map public rapid type 2 ccs chademo" },
  { id: "lendawatt", title: "Lendawatt", detail: "Community charging", to: "/ev-chargers/community", kind: "chargers", keywords: "lendawatt community charging charger chargers charge emergency stranded range host" },
  { id: "home-charging", title: "Home EV charging", detail: "Home charger guide", to: "/ev-chargers/home", kind: "chargers", keywords: "home ev electric charging charger chargers installation" },
  { id: "fuel", title: "Fuel prices", detail: "Petrol and diesel", to: "/fuel-prices", kind: "tools", keywords: "fuel petrol diesel station stations cheap cheapest prices" },
  { id: "faults", title: "Fix a problem", detail: "Car faults and repairs", to: "/diagnose", kind: "tools", keywords: "diagnose diagnostic diagnostics fix fault faults problem problems repair repairs" },
  { id: "marketplace", title: "Buy & Sell", detail: "Car and parts adverts", to: "/marketplace", kind: "tools", keywords: "ad ads advert adverts listing listings sale buy sell marketplace parts cars" },
  { id: "businesses", title: "Businesses", detail: "Garages, services and dealers", to: "/businesses", kind: "tools", keywords: "business businesses mechanic mechanics garage garages service services dealer dealers mot" },
  { id: "groups", title: "Groups", detail: "Clubs and owners’ groups", to: "/groups", kind: "tools", keywords: "group groups club clubs community owners" },
] as const;

export function searchTools(query: string) {
  const words = cleanSearchQuery(query).toLowerCase().split(" ").filter(Boolean);
  if (!words.length) return [];
  return SEARCH_TOOLS.filter((tool) => words.every((word) => `${tool.title} ${tool.keywords}`.toLowerCase().includes(word)));
}