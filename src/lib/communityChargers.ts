import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** True when the signed-in member has an electric car in their garage — used to put EV features first. */
export function useOwnsEv(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["owns-ev", user?.id],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("garage_cars")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("fuel_type", "electric")
        .eq("ownership_status", "current");
      return (count ?? 0) > 0;
    },
  });
  return !!data;
}

// Community home-charger help network. Location rules (docs/LOCATION_PRIVACY.md):
// hosts store a postcode district + ~1 km point (rounded in the database);
// drivers only ever see distance bands until a host approves a request and
// types a meeting place, which expires after 4 hours.

export type ChargerHost = {
  user_id: string;
  mode: "emergency" | "any";
  cost: "free" | "paid";
  price_note: string | null;
  connector: "type2_socket" | "type2_tethered" | "three_pin";
  kw: number;
  fits: "small" | "large" | "van";
  notes: string | null;
  district: string;
  lat: number;
  lng: number;
  discoverable: boolean;
  paused: boolean;
};

export const CONNECTOR_LABEL: Record<string, string> = {
  type2_socket: "Type 2 socket (bring your cable)",
  type2_tethered: "Type 2 tethered cable",
  three_pin: "3-pin plug (slow)",
  type2: "Type 2",
  not_sure: "Not sure",
};
export const FITS_LABEL: Record<string, string> = {
  small: "Small car driveway",
  large: "Fits most cars",
  van: "Fits vans and big SUVs",
};

export async function fetchMyHost(userId: string): Promise<ChargerHost | null> {
  const { data, error } = await supabase
    .from("charger_hosts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ChargerHost | null) ?? null;
}

export async function saveMyHost(host: ChargerHost) {
  const { error } = await supabase.from("charger_hosts").upsert(host, { onConflict: "user_id" });
  if (error) throw error;
}

export async function deleteMyHost(userId: string) {
  const { error } = await supabase.from("charger_hosts").delete().eq("user_id", userId);
  if (error) throw error;
}

export type NearbyHost = {
  host_id: string;
  username: string;
  avatar_url: string | null;
  band: string;
  band_order: number;
  connector: string;
  kw: number;
  fits: string;
  cost: string;
  price_note: string | null;
  mode: string;
  notes: string | null;
  thumbs_up: number;
};

export async function findNearbyHosts(lat: number, lng: number, emergency: boolean) {
  const { data, error } = await supabase.rpc("nearby_charger_hosts", {
    p_lat: lat,
    p_lng: lng,
    p_emergency: emergency,
  });
  if (error) throw error;
  return (data ?? []) as NearbyHost[];
}

export async function requestCharge(input: {
  host: string;
  car: string;
  connector: string;
  range: number | null;
  emergency: boolean;
  message: string;
}) {
  const { error } = await supabase.rpc("request_charge", {
    p_host: input.host,
    p_car: input.car,
    p_connector: input.connector,
    p_range: input.range as number,
    p_emergency: input.emergency,
    p_message: input.message,
  });
  if (error) throw error;
}

export type ChargeRequest = {
  id: string;
  role: "host" | "driver";
  other_id: string;
  other_username: string;
  other_avatar: string | null;
  car: string;
  connector: string;
  range_miles: number | null;
  emergency: boolean;
  message: string | null;
  status: string;
  shared_location: string | null;
  expires_at: string | null;
  rating: number | null;
  created_at: string;
};

export async function fetchMyRequests() {
  const { data, error } = await supabase.rpc("my_charge_requests");
  if (error) throw error;
  return (data ?? []) as ChargeRequest[];
}

export async function respondToRequest(id: string, action: string, location = "") {
  const { error } = await supabase.rpc("respond_charge_request", {
    p_request: id,
    p_action: action,
    p_location: location,
  });
  if (error) throw error;
}

export async function rateHost(id: string, rating: 1 | -1) {
  const { error } = await supabase.rpc("rate_charge_host", { p_request: id, p_rating: rating });
  if (error) throw error;
}

export type CommunityStats = { hosts: number; ev_drivers: number; helped: number };

/** Real network numbers — never inflated. */
export async function fetchCommunityStats(): Promise<CommunityStats> {
  const { data, error } = await supabase.rpc("community_charger_stats");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as CommunityStats | undefined;
  return row ?? { hosts: 0, ev_drivers: 0, helped: 0 };
}

/** True when the signed-in member is registered as a Community Charger host. */
export function useIsChargerHost(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-charger-host", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyHost(user!.id),
  });
  return !!data;
}

export type HostReview = { id: string; reviewer_username: string; reviewer_avatar: string | null; rating: number; review: string | null; created_at: string };

export async function fetchHostReviews(hostId: string) {
  const { data, error } = await supabase.rpc("charge_host_reviews", { p_host: hostId });
  if (error) throw error;
  return (data ?? []) as HostReview[];
}

export async function leaveHostReview(id: string, rating: 1 | -1, review: string) {
  const { error } = await supabase.rpc("leave_charge_review", { p_request: id, p_rating: rating, p_review: review });
  if (error) throw error;
}
