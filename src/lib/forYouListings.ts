import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// "Latest for sale" ranking: adverts that match a member's own cars, saved
// searches and recently viewed adverts come first; everything else stays in
// newest-first order. Scoring is local — nothing new is stored.

export type ListingLike = {
  id: string;
  make: string | null;
  model: string | null;
  part_category: string | null;
  type: string;
  created_at: string;
};

export type Interest = { make: string; model: string | null; weight: number };
export type Signals = { interests: Interest[]; partCategories: string[] };

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function scoreListing(l: ListingLike, signals: Signals): number {
  let score = 0;
  const make = norm(l.make);
  const model = norm(l.model);
  for (const i of signals.interests) {
    if (!make || norm(i.make) !== make) continue;
    const modelMatch = i.model && norm(i.model) === model;
    // Parts for a car you own are worth more than another whole car of the same make.
    score += i.weight * (modelMatch ? 2 : 1) * (l.type === "part" && modelMatch ? 1.5 : 1);
  }
  if (l.part_category && signals.partCategories.includes(norm(l.part_category))) score += 2;
  return score;
}

/** Ranks by interest score, newest first within a tie. Stable for members with no signals. */
export function rankListings<T extends ListingLike>(listings: T[], signals: Signals): T[] {
  return listings
    .map((l, index) => ({ l, index, s: scoreListing(l, signals) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.l);
}

export function buildSignals(input: {
  garage: { make: string | null; model: string | null }[];
  savedFilters: unknown[];
  viewed: ListingLike[];
}): Signals {
  const interests: Interest[] = [];
  const partCategories = new Set<string>();
  for (const c of input.garage) if (c.make) interests.push({ make: c.make, model: c.model, weight: 5 });
  for (const f of input.savedFilters) {
    const o = (f && typeof f === "object" ? f : {}) as { make?: unknown; model?: unknown; partCategory?: unknown };
    if (typeof o.make === "string" && o.make) interests.push({ make: o.make, model: typeof o.model === "string" ? o.model : null, weight: 4 });
    if (typeof o.partCategory === "string") partCategories.add(norm(o.partCategory));
  }
  for (const v of input.viewed) {
    if (v.make) interests.push({ make: v.make, model: v.model, weight: 2 });
    if (v.part_category) partCategories.add(norm(v.part_category));
  }
  return { interests, partCategories: [...partCategories] };
}

/** Garage cars and saved-search filters for the signed-in member. */
export function useListingInterests() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["listing-interests", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [garage, saved] = await Promise.all([
        supabase.from("garage_cars").select("make, model").eq("user_id", user!.id).eq("ownership_status", "current"),
        supabase.from("saved_searches").select("filters").eq("user_id", user!.id),
      ]);
      return {
        garage: (garage.data ?? []) as { make: string | null; model: string | null }[],
        savedFilters: (saved.data ?? []).map((s) => s.filters as unknown),
      };
    },
  });
  return data ?? { garage: [], savedFilters: [] };
}
