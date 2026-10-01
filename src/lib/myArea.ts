import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyArea, useBusinessesFeature } from "@/lib/businesses";
import { lookupDistrict, type PlaceFix } from "@/lib/marketDeals";

// A member's private area (member_areas, 0046): the first half of their
// postcode. Never shown to anyone else — it's only turned into rough
// distances ("12 mi away") on listings, meets and local businesses.
// Read docs/LOCATION_PRIVACY.md before using location anywhere new.

export const myAreaKey = (userId: string | undefined) => ["my-area", userId];

/** The member's saved district, e.g. "LS6" (null when signed out or not set). */
export function useMyArea() {
  const { user } = useAuth();
  const available = useBusinessesFeature();
  const query = useQuery({
    queryKey: myAreaKey(user?.id),
    queryFn: () => fetchMyArea(user!.id),
    enabled: !!user && available,
    staleTime: 10 * 60_000,
  });
  return { available: available && !!user, district: query.data ?? null, loading: query.isLoading };
}

/** The rough centre of the member's area, for working out distances. */
export function useMyPlace(): PlaceFix | null {
  const { district } = useMyArea();
  const { data } = useQuery({
    queryKey: ["district-centre", district],
    queryFn: () => lookupDistrict(district!),
    enabled: !!district,
    staleTime: Infinity,
    retry: false,
  });
  return data ?? null;
}

/** "Under a mile", "3 mi", "120 mi" — rounded so it never pinpoints anyone. */
export function roughMiles(miles: number): string {
  if (miles < 1) return "Under a mile";
  if (miles < 10) return `${Math.round(miles)} mi`;
  return `${Math.round(miles / 5) * 5} mi`;
}
