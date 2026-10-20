import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { looseDb } from "@/lib/looseDb";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// Local businesses, member reviews and the ads manager
// (0046_businesses_and_ads.sql).

export type Business = Tables<"businesses">;
export type BusinessReview = Tables<"business_reviews"> & {
  profiles: { username: string; avatar_url: string | null } | null;
};
export type AdCampaign = Tables<"ad_campaigns">;
export type AdCampaignDraft = Omit<
  TablesInsert<"ad_campaigns">,
  "id" | "impressions" | "clicks" | "created_by" | "created_at"
>;

/** The sectors on the directory, each with its kinds of business. */
export const BUSINESS_SECTORS: {
  id: string;
  label: string;
  emoji: string;
  categories: [id: string, label: string][];
}[] = [
  {
    id: "dealers",
    label: "Dealerships",
    emoji: "🚘",
    categories: [
      ["dealer", "Used car dealer"],
      ["franchise_dealer", "Franchise dealer"],
      ["prestige_dealer", "Prestige & performance dealer"],
      ["van_dealer", "Van dealer"],
      ["motorbike_dealer", "Motorbike dealer"],
      ["car_buying", "We buy cars"],
    ],
  },
  {
    id: "repairs",
    label: "Servicing & repairs",
    emoji: "🔧",
    categories: [
      ["garage", "Garage / servicing"],
      ["mobile_mechanic", "Mobile mechanic"],
      ["mot_centre", "MOT centre"],
      ["specialist", "Make specialist"],
      ["auto_electrician", "Auto electrician"],
      ["diagnostics", "Diagnostics"],
      ["air_con", "Air con"],
      ["exhaust_centre", "Exhausts"],
      ["clutch_gearbox", "Clutch & gearbox"],
    ],
  },
  {
    id: "body",
    label: "Body & glass",
    emoji: "🎨",
    categories: [
      ["bodywork", "Bodywork & paint"],
      ["smart_repair", "Smart repair & dents"],
      ["windscreen", "Windscreens & glass"],
      ["wraps", "Wraps & paint protection"],
    ],
  },
  {
    id: "care",
    label: "Care & detailing",
    emoji: "✨",
    categories: [
      ["detailing", "Detailing & valeting"],
      ["car_wash", "Car wash"],
    ],
  },
  {
    id: "wheels",
    label: "Wheels & tyres",
    emoji: "🛞",
    categories: [
      ["tyres", "Tyres"],
      ["wheel_refurb", "Alloy wheel refurb"],
      ["alignment", "Wheel alignment"],
    ],
  },
  {
    id: "performance",
    label: "Performance & style",
    emoji: "🏁",
    categories: [
      ["tuning", "Tuning & remapping"],
      ["car_audio", "Audio, dashcams & trackers"],
      ["restoration", "Classic restoration"],
      ["motorsport", "Track days & motorsport"],
    ],
  },
  {
    id: "parts",
    label: "Parts",
    emoji: "⚙️",
    categories: [
      ["parts", "Parts supplier"],
      ["breakers", "Breakers & salvage"],
      ["accessories", "Accessories"],
    ],
  },
  {
    id: "electric",
    label: "Electric",
    emoji: "⚡",
    categories: [
      ["ev_charger_installer", "EV charger installer"],
      ["ev_specialist", "EV & hybrid specialist"],
    ],
  },
  {
    id: "services",
    label: "Services",
    emoji: "🧾",
    categories: [
      ["recovery", "Recovery"],
      ["insurance", "Insurance"],
      ["finance", "Car finance"],
      ["car_hire", "Car & van hire"],
      ["driving_school", "Driving school"],
      ["storage", "Car storage"],
      ["transport", "Car transport"],
      ["number_plates", "Private plates"],
      ["inspection", "Pre-purchase inspection"],
      ["other", "Other"],
    ],
  },
];

export const BUSINESS_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  BUSINESS_SECTORS.flatMap((s) => s.categories),
);

/** Kinds of business that worked before 0070 (the rest need that SQL). */
export const LEGACY_BUSINESS_CATEGORIES = [
  "mobile_mechanic",
  "garage",
  "bodywork",
  "ev_charger_installer",
  "detailing",
  "tyres",
  "tuning",
  "dealer",
  "parts",
  "recovery",
  "mot_centre",
  "insurance",
  "other",
];

export function sectorOf(category: string) {
  return BUSINESS_SECTORS.find((s) => s.categories.some(([id]) => id === category)) ?? null;
}

export const REPORT_REASONS: Record<string, string> = {
  scam: "Scam or fraud",
  poor_work: "Poor or unsafe work",
  overcharging: "Overcharging",
  fake_reviews: "Fake reviews",
  unsafe: "Dangerous behaviour",
  other: "Something else",
};

/** UK postcode district from a postcode or district ("LS6 2AB" → "LS6"). */
export function postcodeDistrict(input: string): string | null {
  const compact = input.toUpperCase().replace(/\s+/g, "");
  const full = /^([A-Z]{1,2}[0-9][0-9A-Z]?)[0-9][A-Z]{2}$/.exec(compact);
  if (full) return full[1]!;
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?$/.test(compact) ? compact : null;
}

/**
 * RevMate's trust signal, from member reviews and upheld reports: "trusted"
 * needs a solid track record, "caution" warns buyers about a poor one.
 */
export function trustLevel(b: Pick<Business, "rating_avg" | "reviews_count" | "reports_count">) {
  const rating = Number(b.rating_avg);
  if (b.reviews_count >= 3 && (rating < 2.5 || b.reports_count >= 3)) return "caution" as const;
  if (b.reviews_count >= 5 && rating >= 4.3 && b.reports_count === 0) return "trusted" as const;
  return "new" as const;
}

export function useBusinessesFeature(): boolean {
  return true;
}

/** Business Pro (0064): paid placement, so it's always labelled "Promoted". */
export function isPromotedBusiness(b: object) {
  const until = (b as { promoted_until?: string | null }).promoted_until;
  return !!until && new Date(until).getTime() > Date.now();
}

/** Promoted (Business Pro) first; otherwise keeps the existing order. */
function promotedFirst<T extends object>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(isPromotedBusiness(b)) - Number(isPromotedBusiness(a)));
}

export async function fetchBusinesses(filters: {
  category?: string | undefined;
  sector?: string | undefined;
  area?: string | undefined;
}) {
  let query = supabase
    .from("businesses")
    .select("*")
    .eq("status", "active")
    .order("verified", { ascending: false })
    .order("rating_avg", { ascending: false })
    .limit(200);
  if (filters.category) query = query.eq("category", filters.category);
  else if (filters.sector) {
    const sector = BUSINESS_SECTORS.find((s) => s.id === filters.sector);
    if (sector)
      query = query.in(
        "category",
        sector.categories.map(([id]) => id),
      );
  }
  const { data, error } = await query;
  if (error) throw error;
  const sorted = promotedFirst(data);
  const area = filters.area?.trim().toUpperCase();
  if (!area) return sorted;
  // Match the district, its wider area (LS6 → LS) or places they cover.
  const prefix = area.replace(/[0-9].*$/, "");
  return sorted.filter(
    (b) =>
      b.postcode_district?.startsWith(area) ||
      b.covers_areas.some(
        (c) => area.startsWith(c.toUpperCase()) || c.toUpperCase().startsWith(area),
      ) ||
      b.town?.toUpperCase().includes(area) ||
      (!!prefix && prefix !== area && b.postcode_district?.replace(/[0-9].*$/, "") === prefix),
  );
}

export async function fetchBusiness(id: string) {
  const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyBusinesses(userId: string) {
  const { data, error } = await supabase.from("businesses").select("*").eq("owner_user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createMyBusiness(fields: Pick<TablesInsert<"businesses">, "name" | "category" | "description" | "town" | "contact_name" | "email" | "phone" | "logo_url">) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in to add your business.");
  const id = crypto.randomUUID();
  const { error } = await supabase.from("businesses").insert({ ...fields, id, owner_user_id: auth.user.id, verified: false, status: "active" });
  if (error) throw error;
  return id;
}

export async function fetchReviews(businessId: string): Promise<BusinessReview[]> {
  const { data, error } = await supabase
    .from("business_reviews")
    .select("*, profiles!business_reviews_user_id_fkey(username, avatar_url)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as BusinessReview[];
}

export async function saveReview(
  businessId: string,
  userId: string,
  rating: number,
  body: string,
  existingId?: string,
): Promise<string> {
  const id = existingId ?? crypto.randomUUID();
  const { error } = existingId
    ? await supabase
        .from("business_reviews")
        .update({ rating, body: body.trim() })
        .eq("id", existingId)
    : await supabase.from("business_reviews").insert({
        id,
        business_id: businessId,
        user_id: userId,
        rating,
        body: body.trim(),
      });
  if (error) throw error;
  return id;
}

export async function deleteReview(id: string) {
  const { error } = await supabase.from("business_reviews").delete().eq("id", id);
  if (error) throw error;
}

export async function reportBusiness(
  businessId: string,
  userId: string,
  reason: string,
  details: string,
) {
  const { error } = await supabase
    .from("business_reports")
    .insert({ business_id: businessId, reporter_id: userId, reason, details: details.trim() });
  if (error) {
    if ((error as { code?: string }).code === "23505")
      throw new Error("You've already reported this business.");
    throw error;
  }
}

// ---------- Member area (for local offers) ----------

export async function fetchMyArea(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("member_areas")
    .select("home_area")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.home_area ?? null;
}

export async function saveMyArea(userId: string, area: string | null) {
  const { error } = area
    ? await supabase
        .from("member_areas")
        .upsert({ user_id: userId, home_area: area, updated_at: new Date().toISOString() })
    : await supabase.from("member_areas").delete().eq("user_id", userId);
  if (error) throw error;
}

// ---------- Admin ----------

export async function fetchAllBusinesses() {
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveBusiness(fields: TablesInsert<"businesses">, id?: string) {
  const { error } = id
    ? await supabase.from("businesses").update(fields).eq("id", id)
    : await supabase.from("businesses").insert({ ...fields, id: crypto.randomUUID() });
  if (error) throw error;
}

export async function fetchOpenBusinessReports() {
  const { data, error } = await supabase
    .from("business_reports")
    .select("*, businesses(name)")
    .eq("status", "open")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as (Tables<"business_reports"> & {
    businesses: { name: string } | null;
  })[];
}

export async function setBusinessReportStatus(id: string, status: "upheld" | "dismissed") {
  const { error } = await supabase.from("business_reports").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchCampaigns() {
  const { data, error } = await supabase
    .from("ad_campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveCampaign(draft: AdCampaignDraft, id?: string) {
  const { error } = id
    ? await supabase.from("ad_campaigns").update(draft).eq("id", id)
    : await supabase.from("ad_campaigns").insert({ ...draft, id: crypto.randomUUID() });
  if (error) throw error;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from("ad_campaigns").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Ads shown to members ----------

export type AdForMe = {
  id: string;
  headline: string;
  body: string;
  image_url: string | null;
  cta_label: string;
  cta_url: string;
  business_id: string | null;
  business_name: string | null;
  business_rating: number | null;
  business_reviews: number | null;
  business_verified: boolean | null;
};

export async function fetchAdsForMe(placement: "feed" | "marketplace"): Promise<AdForMe[]> {
  const { data, error } = await supabase.rpc("ads_for_me", {
    for_placement: placement,
    result_limit: 5,
  });
  if (error) return [];
  return data as AdForMe[];
}

export function recordAdEvent(adId: string, event: "impression" | "click") {
  void supabase.rpc("record_ad_event", { target_ad: adId, event }).then(() => undefined);
}

export async function setCampaignActive(id: string, active: boolean) {
  const { error } = await supabase.from("ad_campaigns").update({ active }).eq("id", id);
  if (error) throw error;
}

// ---------- Profiles: photos, hours, replies (0070_business_profiles.sql) ----------

export const DAYS = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"],
] as const;
export type DayKey = (typeof DAYS)[number][0];
export type OpeningHours = Partial<Record<DayKey, { open: string; close: string } | null>>;

/** The profile fields 0070 adds (not in the generated types until it runs). */
export type BusinessProfile = Business & {
  address?: string | null;
  email?: string | null;
  opening_hours?: OpeningHours | null;
  services?: string[];
};

export type BusinessPhoto = {
  id: string;
  business_id: string;
  review_id: string | null;
  uploaded_by: string | null;
  source: "business" | "customer";
  url: string;
  caption: string;
  position: number;
  created_at: string;
};

/** True once 0070 has run (photo galleries, hours, replies, new sectors). */
export function useBusinessProfilesFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "business-profiles"],
    queryFn: async () => !(await looseDb.from("business_photos").select("id").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

/** Day key and minutes past midnight, in UK time. */
function ukNow(now: Date): { day: DayKey; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday").slice(0, 3).toLowerCase() as DayKey;
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** "Open · Closes 17:30" / "Closed · Opens 08:00 Mon", or null without hours. */
export function openStatus(
  hours: OpeningHours | null | undefined,
  now = new Date(),
): { open: boolean; text: string } | null {
  if (!hours || Object.keys(hours).length === 0) return null;
  const { day, minutes } = ukNow(now);
  const today = hours[day];
  if (today) {
    const open = toMinutes(today.open);
    const close = toMinutes(today.close);
    if (minutes >= open && minutes < close) return { open: true, text: `Closes ${today.close}` };
    if (minutes < open) return { open: false, text: `Opens ${today.open}` };
  }
  const start = DAYS.findIndex(([k]) => k === day);
  for (let i = 1; i <= 7; i++) {
    const [key, name] = DAYS[(start + i) % 7]!;
    const next = hours[key];
    if (next)
      return { open: false, text: `Opens ${next.open} ${i === 1 ? "tomorrow" : name.slice(0, 3)}` };
  }
  return { open: false, text: "Closed" };
}

export function todayKey(now = new Date()): DayKey {
  return ukNow(now).day;
}

export async function fetchBusinessPhotos(businessId: string): Promise<BusinessPhoto[]> {
  const { data, error } = await looseDb
    .from("business_photos")
    .select("*")
    .eq("business_id", businessId)
    .order("source")
    .order("position")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return data as BusinessPhoto[];
}

/** First photos for each business in a list (business photos first) and how many. */
export async function fetchPhotoSummaries(
  businessIds: string[],
): Promise<Map<string, { urls: string[]; count: number }>> {
  const out = new Map<string, { urls: string[]; count: number }>();
  if (businessIds.length === 0) return out;
  const { data, error } = await looseDb
    .from("business_photos")
    .select("business_id, url, source, position, created_at")
    .in("business_id", businessIds)
    .order("source")
    .order("position")
    .limit(2000);
  if (error) return out;
  for (const p of data as Pick<BusinessPhoto, "business_id" | "url">[]) {
    const entry = out.get(p.business_id) ?? { urls: [], count: 0 };
    entry.count++;
    if (entry.urls.length < 3) entry.urls.push(p.url);
    out.set(p.business_id, entry);
  }
  return out;
}

export async function addBusinessPhoto(businessId: string, url: string, reviewId?: string) {
  const { error } = await looseDb.from("business_photos").insert({
    business_id: businessId,
    url,
    ...(reviewId ? { review_id: reviewId } : {}),
  });
  if (error) throw new Error(error.message);
}

export async function deleteBusinessPhoto(id: string) {
  const { error } = await looseDb.from("business_photos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function replyToReview(reviewId: string, reply: string) {
  const { error } = await looseDb.rpc("reply_to_review", { p_review: reviewId, p_reply: reply });
  if (error) throw new Error(error.message);
}

/** Owner or admin: the profile details 0070 adds, plus description and contacts. */
export async function saveBusinessProfile(
  id: string,
  fields: {
    name: string;
    category: string;
    town: string | null;
    contact_name: string | null;
    logo_url: string | null;
    description: string;
    phone: string | null;
    website: string | null;
    email: string | null;
    address: string | null;
    services: string[];
    opening_hours: OpeningHours | null;
  },
) {
  const { error } = await looseDb.from("businesses").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
}
