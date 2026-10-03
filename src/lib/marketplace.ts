import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Marketplace browsing: the grid, watchlist, price drops, views and
// sponsored partners (0035_marketplace.sql). Watchlist, views, price drops,
// Featured and partners only switch on once useMarketplaceFeatures() is true.

export type MarketListing = Tables<"listings"> & {
  cars: { make: string; model: string; generation: string } | null;
  garage_cars: {
    id: string;
    nickname: string;
    make: string;
    model: string;
    year: number | null;
    likes_count: number;
  } | null;
};

const MARKET_SELECT =
  "*, cars(make, model, generation), garage_cars(id, nickname, make, model, year, likes_count)";

export function useMarketplaceFeatures(): boolean {
  return true;
}

export async function fetchMarketListings(): Promise<MarketListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(MARKET_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as unknown as MarketListing[];
}

export function isFeatured(listing: Pick<Tables<"listings">, "featured_until">) {
  return !!listing.featured_until && new Date(listing.featured_until).getTime() > Date.now();
}

export function isNewToday(listing: Pick<Tables<"listings">, "created_at">) {
  return Date.now() - new Date(listing.created_at).getTime() < 24 * 60 * 60 * 1000;
}

/** The price came down in the last 14 days (older drops stop being news). */
export function hasRecentPriceDrop(
  listing: Pick<Tables<"listings">, "previous_price" | "price" | "price_changed_at">,
) {
  return (
    listing.previous_price != null &&
    listing.price != null &&
    Number(listing.price) < Number(listing.previous_price) &&
    !!listing.price_changed_at &&
    Date.now() - new Date(listing.price_changed_at).getTime() < 14 * 24 * 60 * 60 * 1000
  );
}

export function formatPrice(price: number | string | null | undefined) {
  if (price == null) return "POA";
  return `£${Number(price).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

// ---------- Watchlist ----------

export async function fetchMyWatchlistIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("saved_listings")
    .select("listing_id")
    .eq("user_id", userId)
    .limit(2000);
  if (error) throw error;
  return new Set(data.map((row) => row.listing_id));
}

export async function watchListing(listingId: string, userId: string) {
  const { error } = await supabase
    .from("saved_listings")
    .upsert(
      { listing_id: listingId, user_id: userId },
      { onConflict: "user_id,listing_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unwatchListing(listingId: string, userId: string) {
  const { error } = await supabase
    .from("saved_listings")
    .delete()
    .eq("listing_id", listingId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ---------- Views, price changes ----------

export async function recordListingView(listingId: string) {
  await supabase.rpc("record_listing_view", { target_listing: listingId });
}

export async function changeListingPrice(listingId: string, price: number | null) {
  const { error } = await supabase.from("listings").update({ price }).eq("id", listingId);
  if (error) throw error;
}

export async function setListingFeatured(listingId: string, days: number | null) {
  const featured_until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
  const { error } = await supabase.from("listings").update({ featured_until }).eq("id", listingId);
  if (error) throw error;
}

// ---------- Sponsored partners ----------

export type Partner = Tables<"marketplace_partners">;

export async function fetchPartners(includeInactive = false): Promise<Partner[]> {
  let query = supabase.from("marketplace_partners").select("*").order("sort_order");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query.limit(50);
  if (error) throw error;
  return data;
}

export function recordPartnerClick(partnerId: string) {
  void supabase.rpc("record_partner_click", { target_partner: partnerId });
}

export async function savePartner(
  partner: Pick<Partner, "name" | "tagline" | "url" | "cta" | "placement" | "image_url"> & {
    id?: string;
  },
) {
  const { error } = partner.id
    ? await supabase.from("marketplace_partners").update(partner).eq("id", partner.id)
    : await supabase.from("marketplace_partners").insert(partner);
  if (error) throw error;
}

export async function setPartnerActive(partnerId: string, active: boolean) {
  const { error } = await supabase
    .from("marketplace_partners")
    .update({ active })
    .eq("id", partnerId);
  if (error) throw error;
}

export async function deletePartner(partnerId: string) {
  const { error } = await supabase.from("marketplace_partners").delete().eq("id", partnerId);
  if (error) throw error;
}

// ---------- Per-device browsing memory (no account needed) ----------

const LAST_VISIT_KEY = "revmate:marketLastVisit";
const RECENT_KEY = "revmate:marketRecentlyViewed";

/** When you last opened Buy & Sell, so new listings since then stand out. */
export function readLastMarketVisit(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_VISIT_KEY));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function markMarketVisited() {
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function readRecentlyViewed(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string").slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function rememberViewedListing(listingId: string) {
  try {
    const next = [listingId, ...readRecentlyViewed().filter((id) => id !== listingId)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}
