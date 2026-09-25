import { supabase } from "@/integrations/supabase/client";

export const SELLER_REPORT_REASONS = {
  scam: "Scam or fraud",
  not_as_described: "Car not as described",
  no_show: "Seller didn't show up",
  abusive: "Abusive or threatening",
  other: "Something else",
} as const;

export type SellerReportReason = keyof typeof SELLER_REPORT_REASONS;

export async function reportSeller(input: {
  listingId: string;
  sellerId: string;
  reporterId: string;
  reason: SellerReportReason;
  details: string;
}) {
  const { error } = await supabase.from("seller_reports").insert({
    listing_id: input.listingId,
    seller_id: input.sellerId,
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details.trim(),
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error("You've already reported this advert.");
    }
    throw error;
  }
}

export type SellerScore = {
  listingsCount: number;
  actionedReports: number;
  score: number;
};

export async function fetchSellerScore(userId: string): Promise<SellerScore> {
  const { data, error } = await supabase.rpc("seller_score", { target_user: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    listingsCount: Number(row?.listings_count ?? 0),
    actionedReports: Number(row?.actioned_reports ?? 0),
    score: Number(row?.score ?? 5),
  };
}
