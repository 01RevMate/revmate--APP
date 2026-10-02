import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { listingMake, listingModel, listingYear, type CarFilters } from "@/lib/carFilters";
import { postcodeDistrict } from "@/lib/businesses";
import type { MarketListing } from "@/lib/marketplace";

// Buy & Sell upgrade (0051_marketplace_upgrade.sql): parts details,
// distance, saved searches, offers, seller reviews and trust stats — plus
// the price guide, similar listings, compare and "fits your car", which
// work from listings already loaded and need no SQL.

/** True once 0051 has run (saved searches, offers, reviews, parts fields, distance). */
export function useMarketUpgradeFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "market-upgrade"],
    queryFn: async () => !(await supabase.from("saved_searches").select("id").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

// ---------- Parts ----------

export const PART_CATEGORY_LABELS: Record<string, string> = {
  wheels_tyres: "Wheels & tyres",
  exhaust: "Exhausts",
  lighting: "Lighting",
  interior: "Interior",
  audio: "Audio & sound",
  body: "Body & styling",
  performance: "Performance",
  engine: "Engine parts",
  suspension_brakes: "Suspension & brakes",
  electrical: "Electrical",
  detailing: "Detailing & care",
  tools: "Tools & garage",
  accessories: "Accessories",
  other: "Other",
};

export const CONDITION_LABELS: Record<string, string> = {
  new: "New",
  used: "Used",
  refurbished: "Refurbished",
};

export type PartDetails = {
  part_category: string | null;
  item_condition: string | null;
  collection_available: boolean;
  postage_available: boolean;
  postage_price: number | null;
};

export const EMPTY_PART_DETAILS: PartDetails = {
  part_category: null,
  item_condition: "used",
  collection_available: true,
  postage_available: false,
  postage_price: null,
};

export type RunningCosts = {
  co2_gkm: number | null;
  mpg: number | null;
  insurance_group: number | null;
};

export const EMPTY_RUNNING_COSTS: RunningCosts = {
  co2_gkm: null,
  mpg: null,
  insurance_group: null,
};

/** "Collection or £5 postage" — how the buyer gets it. */
export function deliveryLabel(
  l: Pick<Tables<"listings">, "collection_available" | "postage_available" | "postage_price">,
): string | null {
  const post = l.postage_available
    ? l.postage_price != null && Number(l.postage_price) > 0
      ? `£${Number(l.postage_price).toLocaleString("en-GB")} postage`
      : "Free postage"
    : null;
  if (post && l.collection_available) return `Collection or ${post.toLowerCase()}`;
  if (post) return post;
  return l.collection_available ? "Collection only" : null;
}

// ---------- Location & distance ----------

export type PlaceFix = { district: string; lat: number; lng: number; town: string | null };

/** Looks up the rough centre of a postcode district (free postcodes.io data). */
export async function lookupDistrict(input: string): Promise<PlaceFix> {
  const district = postcodeDistrict(input);
  if (!district) throw new Error("Enter a UK postcode or the first half, e.g. LS6.");
  const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(district)}`);
  if (!res.ok) throw new Error(`We couldn't find ${district}. Check the postcode.`);
  const body = (await res.json()) as {
    result?: { latitude: number | null; longitude: number | null; admin_district?: string[] };
  };
  const lat = body.result?.latitude;
  const lng = body.result?.longitude;
  if (lat == null || lng == null)
    throw new Error(`We couldn't find ${district}. Check the postcode.`);
  return {
    district,
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
    town: body.result?.admin_district?.[0] ?? null,
  };
}

/** Miles between two points (as the crow flies). */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export function listingMiles(
  l: Pick<Tables<"listings">, "location_lat" | "location_lng">,
  from: { lat: number; lng: number } | null,
): number | null {
  if (!from || l.location_lat == null || l.location_lng == null) return null;
  return milesBetween(from, { lat: l.location_lat, lng: l.location_lng });
}

const PLACE_KEY = "revmate:marketPlace";

export function readSavedPlace(): PlaceFix | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null") as PlaceFix | null;
    return parsed && typeof parsed.lat === "number" && typeof parsed.lng === "number"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function savePlace(place: PlaceFix | null) {
  try {
    if (place) localStorage.setItem(PLACE_KEY, JSON.stringify(place));
    else localStorage.removeItem(PLACE_KEY);
  } catch {
    // ignore
  }
}

// ---------- Saved searches ----------

/** Everything the Buy & Sell page can filter on. Mirrors private.listing_matches_search. */
export type MarketSearch = Partial<CarFilters> & {
  type?: "car" | "part" | undefined;
  query?: string | undefined;
  minPrice?: string | undefined;
  maxPrice?: string | undefined;
  partCategory?: string | undefined;
  condition?: string | undefined;
  postageOnly?: boolean | undefined;
  radius?: string | undefined;
  lat?: string | undefined;
  lng?: string | undefined;
  district?: string | undefined;
};

export type SavedSearch = Omit<Tables<"saved_searches">, "filters"> & { filters: MarketSearch };

export async function fetchSavedSearches(userId: string): Promise<SavedSearch[]> {
  const { data, error } = await supabase
    .from("saved_searches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as SavedSearch[];
}

/** Drops empty values so saved filters stay small and readable. */
export function compactSearch(search: MarketSearch): MarketSearch {
  return Object.fromEntries(
    Object.entries(search).filter(([, v]) => v !== "" && v !== false && v != null),
  ) as MarketSearch;
}

export async function saveSearch(userId: string, name: string, filters: MarketSearch) {
  const { error } = await supabase.from("saved_searches").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    name: name.trim().slice(0, 60) || "My search",
    filters: compactSearch(filters) as unknown as Json,
  });
  if (error) throw error;
}

export async function setSearchAlerts(id: string, alerts: boolean) {
  const { error } = await supabase.from("saved_searches").update({ alerts }).eq("id", id);
  if (error) throw error;
}

export async function deleteSavedSearch(id: string) {
  const { error } = await supabase.from("saved_searches").delete().eq("id", id);
  if (error) throw error;
}

/** "Manual BMW M3 · under £20k · within 25 mi of LS6" */
export function describeSearch(s: MarketSearch, labels?: { fuel?: Record<string, string> }) {
  const parts: string[] = [];
  const what = [
    s.yearFrom ? `${s.yearFrom}+` : null,
    s.gearbox === "manual" ? "manual" : s.gearbox === "automatic" ? "automatic" : null,
    s.fuel ? (labels?.fuel?.[s.fuel] ?? s.fuel).toLowerCase() : null,
    s.make,
    s.model,
    s.partCategory ? PART_CATEGORY_LABELS[s.partCategory]?.toLowerCase() : null,
    !s.make && !s.partCategory
      ? s.type === "car"
        ? "cars"
        : s.type === "part"
          ? "parts"
          : null
      : null,
  ].filter(Boolean);
  if (s.query) parts.push(`"${s.query}"`);
  if (what.length) parts.push(what.join(" "));
  if (s.minPrice && s.maxPrice)
    parts.push(
      `£${Number(s.minPrice).toLocaleString("en-GB")}–£${Number(s.maxPrice).toLocaleString("en-GB")}`,
    );
  else if (s.maxPrice) parts.push(`under £${Number(s.maxPrice).toLocaleString("en-GB")}`);
  else if (s.minPrice) parts.push(`£${Number(s.minPrice).toLocaleString("en-GB")}+`);
  if (s.maxMileage) parts.push(`≤ ${Number(s.maxMileage).toLocaleString("en-GB")} mi`);
  if (s.radius && s.district) parts.push(`within ${s.radius} mi of ${s.district}`);
  if (s.condition) parts.push(CONDITION_LABELS[s.condition]?.toLowerCase() ?? s.condition);
  if (s.postageOnly) parts.push("can post");
  if (s.ulezOnly) parts.push("ULEZ");
  return parts.join(" · ") || "Everything for sale";
}

// ---------- Offers ----------

export type Offer = Tables<"listing_offers">;

export async function fetchOffersForListing(listingId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("listing_offers")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function makeOffer(listingId: string, amount: number, message: string) {
  const { data, error } = await supabase.rpc("make_offer", {
    target_listing: listingId,
    offer_amount: amount,
    offer_message: message,
  });
  if (error) throw error;
  return data;
}

export async function respondToOffer(
  offerId: string,
  action: "accept" | "decline" | "counter" | "withdraw",
  counter?: number,
) {
  const { data, error } = await supabase.rpc("respond_to_offer", {
    target_offer: offerId,
    offer_action: action,
    ...(counter != null ? { new_counter: counter } : {}),
  });
  if (error) throw error;
  return data;
}

// ---------- Seller trust ----------

export type SellerStats = {
  member_since: string;
  active_listings: number;
  sold_listings: number;
  reviews_count: number;
  rating_avg: number | null;
  reply_minutes: number | null;
  replies_sampled: number;
};

export async function fetchSellerStats(sellerId: string): Promise<SellerStats | null> {
  const { data, error } = await supabase.rpc("seller_stats", { target_seller: sellerId });
  if (error) throw error;
  return (data?.[0] as SellerStats | undefined) ?? null;
}

export type SellerReview = Tables<"seller_reviews"> & {
  reviewer: { username: string; avatar_url: string | null } | null;
  listing_title: string | null;
};

export async function fetchSellerReviews(sellerId: string): Promise<SellerReview[]> {
  const { data, error } = await supabase
    .from("seller_reviews")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  if (!data.length) return [];
  const [{ data: people }, { data: listings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, username, avatar_url")
      .in("user_id", [...new Set(data.map((r) => r.reviewer_id))]),
    supabase
      .from("listings")
      .select("id, title")
      .in(
        "id",
        data.map((r) => r.listing_id),
      ),
  ]);
  return data.map((r) => ({
    ...r,
    reviewer: people?.find((p) => p.user_id === r.reviewer_id) ?? null,
    listing_title: listings?.find((l) => l.id === r.listing_id)?.title ?? null,
  }));
}

export async function fetchBuyerCandidates(listingId: string) {
  const { data, error } = await supabase.rpc("listing_buyer_candidates", {
    target_listing: listingId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function setListingBuyer(listingId: string, buyerId: string) {
  const { error } = await supabase.rpc("set_listing_buyer", {
    target_listing: listingId,
    target_buyer: buyerId,
  });
  if (error) throw error;
}

export async function leaveSellerReview(listingId: string, rating: number, body: string) {
  const { error } = await supabase.rpc("leave_seller_review", {
    target_listing: listingId,
    review_rating: rating,
    review_body: body,
  });
  if (error) throw error;
}

/** "Usually replies within an hour" — only once there's enough to go on. */
export function replyTimeLabel(stats: Pick<SellerStats, "reply_minutes" | "replies_sampled">) {
  if (stats.reply_minutes == null || stats.replies_sampled < 3) return null;
  const m = stats.reply_minutes;
  if (m <= 60) return "Usually replies within an hour";
  if (m <= 180) return "Usually replies within a few hours";
  if (m <= 24 * 60) return "Usually replies within a day";
  return "Can take a few days to reply";
}

// ---------- Price guide, similar, fits ----------

export type PriceGuide = {
  label: "Good price" | "Fair price" | "Higher price";
  tone: "good" | "fair" | "high";
  typical: number;
  compared: number;
};

const MIN_COMPARABLES = 4;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const lower = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** Other cars for sale on RevMate that are fair to compare against. */
export function comparableCars(listing: MarketListing, all: MarketListing[]): MarketListing[] {
  if (listing.type !== "car") return [];
  const make = lower(listingMake(listing));
  const model = lower(listingModel(listing));
  if (!make || !model) return [];
  const year = listingYear(listing);
  return all.filter(
    (other) =>
      other.id !== listing.id &&
      other.type === "car" &&
      other.price != null &&
      lower(listingMake(other)) === make &&
      lower(listingModel(other)) === model &&
      (year == null || listingYear(other) == null || Math.abs(listingYear(other)! - year) <= 2),
  );
}

/**
 * How the asking price compares with similar cars listed on RevMate. Only
 * shown when there are enough to be fair — never invented.
 */
export function priceGuide(listing: MarketListing, all: MarketListing[]): PriceGuide | null {
  if (listing.price == null) return null;
  const comps = comparableCars(listing, all);
  if (comps.length < MIN_COMPARABLES) return null;
  const typical = median(comps.map((c) => Number(c.price)));
  if (!typical) return null;
  const ratio = Number(listing.price) / typical;
  const base = { typical: Math.round(typical), compared: comps.length };
  if (ratio <= 0.92) return { ...base, label: "Good price", tone: "good" };
  if (ratio <= 1.08) return { ...base, label: "Fair price", tone: "fair" };
  return { ...base, label: "Higher price", tone: "high" };
}

/** Same car (or same kind of part), closest in price first. */
export function similarListings(listing: MarketListing, all: MarketListing[], limit = 8) {
  const make = lower(listingMake(listing));
  const model = lower(listingModel(listing));
  const price = listing.price != null ? Number(listing.price) : null;
  const score = (other: MarketListing) => {
    let s = 0;
    if (lower(listingMake(other)) === make && make) s += 2;
    if (lower(listingModel(other)) === model && model) s += 3;
    if (listing.part_category && other.part_category === listing.part_category) s += 3;
    return s;
  };
  return all
    .filter((o) => o.id !== listing.id && o.type === listing.type && score(o) >= 2)
    .sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff || price == null) return diff;
      return (
        Math.abs(Number(a.price ?? Infinity) - price) -
        Math.abs(Number(b.price ?? Infinity) - price)
      );
    })
    .slice(0, limit);
}

export type MyCar = { id: string; nickname: string; make: string; model: string };

export async function fetchMyCurrentCars(userId: string): Promise<MyCar[]> {
  const { data, error } = await supabase
    .from("garage_cars")
    .select("id, nickname, make, model")
    .eq("user_id", userId)
    .eq("ownership_status", "current");
  if (error) throw error;
  return data;
}

/** The first car in your garage a part is listed as fitting. */
export function fitsMyCar(listing: MarketListing, cars: MyCar[] | undefined): MyCar | null {
  if (listing.type !== "part" || !cars?.length) return null;
  const make = lower(listingMake(listing));
  const model = lower(listingModel(listing));
  if (!make) return null;
  return (
    cars.find((car) => {
      if (lower(car.make) !== make) return false;
      if (!model) return true;
      const mine = lower(car.model);
      return mine === model || mine.includes(model) || model.includes(mine);
    }) ?? null
  );
}

// ---------- Compare (per device) ----------

const COMPARE_KEY = "revmate:marketCompare";
export const MAX_COMPARE = 3;

export function readCompare(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPARE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string").slice(0, MAX_COMPARE)
      : [];
  } catch {
    return [];
  }
}

export function writeCompare(ids: string[]) {
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(ids.slice(0, MAX_COMPARE)));
    window.dispatchEvent(new Event("revmate:compare"));
  } catch {
    // ignore
  }
}

// ---------- Listing quality (sell form) ----------

export type QualityCheck = { label: string; done: boolean; points: number };

export function listingQuality(input: {
  photos: number;
  description: string;
  headline: string;
  specsFilled: number;
  motDate: boolean;
  serviceHistory: boolean;
  location: boolean;
  isCar: boolean;
}): { score: number; checks: QualityCheck[] } {
  const checks: QualityCheck[] = input.isCar
    ? [
        { label: "8 or more photos", done: input.photos >= 8, points: 25 },
        { label: "At least 5 photos", done: input.photos >= 5, points: 10 },
        {
          label: "A description of 200+ characters",
          done: input.description.trim().length >= 200,
          points: 20,
        },
        { label: "A headline", done: !!input.headline.trim(), points: 5 },
        { label: "Most vehicle details filled in", done: input.specsFilled >= 8, points: 20 },
        { label: "MOT expiry date", done: input.motDate, points: 5 },
        { label: "Service history", done: input.serviceHistory, points: 5 },
        { label: "Your area", done: input.location, points: 10 },
      ]
    : [
        { label: "3 or more photos", done: input.photos >= 3, points: 35 },
        {
          label: "A description of 100+ characters",
          done: input.description.trim().length >= 100,
          points: 30,
        },
        { label: "Category and condition", done: input.specsFilled >= 2, points: 20 },
        { label: "Your area", done: input.location, points: 15 },
      ];
  const score = checks.reduce((sum, c) => sum + (c.done ? c.points : 0), 0);
  return { score, checks };
}

/** Keeps the compare list in sync across the page and other tabs. */
export function useCompareList(): [string[], (ids: string[]) => void] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readCompare());
    sync();
    window.addEventListener("revmate:compare", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("revmate:compare", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [ids, writeCompare];
}

// ---------- Advert strength & ranking ----------

const SPEC_KEYS = [
  "make",
  "model",
  "year",
  "fuel_type",
  "transmission",
  "body_type",
  "engine_size_cc",
  "power_bhp",
  "colour",
  "doors",
  "seats",
  "previous_owners",
  "mot_expiry",
  "service_history",
  "ulez_compliant",
  "v5c_present",
] as const;

/**
 * How complete an advert is (0–100), using the same checks the seller sees
 * while listing. Nothing is required — but stronger adverts rank higher.
 */
export function advertStrength(listing: MarketListing) {
  const row = listing as unknown as Record<string, unknown>;
  const isCar = listing.type === "car";
  return listingQuality({
    isCar,
    photos: listing.photos?.length ?? 0,
    description: listing.description ?? "",
    headline: listing.headline ?? "",
    specsFilled: isCar
      ? SPEC_KEYS.filter((k) => row[k] != null && row[k] !== "").length
      : (listing.part_category ? 1 : 0) + (listing.item_condition ? 1 : 0),
    motDate: !!listing.mot_expiry,
    serviceHistory: !!listing.service_history,
    location: !!listing.location_district || !!listing.location_area,
  });
}

/**
 * "Best match" order: detail counts for about half, freshness for the rest
 * (a brand-new advert still gets seen, and old ones gently sink).
 */
export function rankScore(listing: MarketListing, now = Date.now()) {
  const strength = advertStrength(listing).score; // 0–100
  const ageDays = Math.max(0, (now - new Date(listing.created_at).getTime()) / 86_400_000);
  const freshness = 100 * Math.exp(-ageDays / 10); // halves roughly every week
  const priceSet = listing.price != null ? 5 : 0;
  return strength * 0.55 + freshness * 0.45 + priceSet;
}
