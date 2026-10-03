import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export const BUSINESS_CATEGORY_LABELS: Record<string, string> = {
  mobile_mechanic: "Mobile mechanic",
  garage: "Garage / servicing",
  bodywork: "Bodywork & paint",
  ev_charger_installer: "EV charger installer",
  detailing: "Detailing & valeting",
  tyres: "Tyres",
  tuning: "Tuning & performance",
  dealer: "Car dealer",
  parts: "Parts supplier",
  recovery: "Recovery",
  mot_centre: "MOT centre",
  insurance: "Insurance",
  other: "Other",
};

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

export async function fetchBusinesses(filters: {
  category?: string | undefined;
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
  const { data, error } = await query;
  if (error) throw error;
  const area = filters.area?.trim().toUpperCase();
  if (!area) return data;
  // Match the district, its wider area (LS6 → LS) or places they cover.
  const prefix = area.replace(/[0-9].*$/, "");
  return data.filter(
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
) {
  const { error } = existingId
    ? await supabase
        .from("business_reviews")
        .update({ rating, body: body.trim() })
        .eq("id", existingId)
    : await supabase.from("business_reviews").insert({
        id: crypto.randomUUID(),
        business_id: businessId,
        user_id: userId,
        rating,
        body: body.trim(),
      });
  if (error) throw error;
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
