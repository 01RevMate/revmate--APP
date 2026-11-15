import { useQuery } from "@tanstack/react-query";
import { looseDb } from "@/lib/looseDb";

/**
 * Business approval, tiers, revisions, follows and photo safeguards (migration 0080).
 *
 * Fail closed: every new tool stays hidden until the database itself reports it is fully installed
 * (`business_foundation_ready()`); if that call is missing or fails, everything here is off. Nothing
 * falls back to the old behaviour where a new business went live instantly.
 */

export type ApprovalStatus =
  "draft" | "pending" | "needs_changes" | "approved" | "rejected" | "appealed";
export type BusinessTier = "listing" | "full";

/** The 0080 columns, which the generated Supabase types don't know about yet. */
export type BusinessApproval = {
  approval_status?: ApprovalStatus;
  suspended_at?: string | null;
  suspended_reason?: string | null;
  tier?: BusinessTier;
  review_reason?: string | null;
  appeal_used?: boolean;
  legacy_approved?: boolean;
  submitted_at?: string | null;
};

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  draft: "Draft",
  pending: "Waiting for approval",
  needs_changes: "Changes needed",
  approved: "Approved",
  rejected: "Not approved",
  appealed: "Appeal in review",
};

export function approvalOf(
  b: object,
): Required<Pick<BusinessApproval, "approval_status" | "tier">> & BusinessApproval {
  const a = b as BusinessApproval;
  return { ...a, approval_status: a.approval_status ?? "approved", tier: a.tier ?? "listing" };
}

export function isLive(b: object): boolean {
  const a = approvalOf(b);
  return a.approval_status === "approved" && !a.suspended_at;
}

async function rpc<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await looseDb.rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** True only when the database reports the whole business foundation is installed. */
export function useBusinessFoundation(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "business-foundation"],
    queryFn: async () => {
      try {
        const { data, error } = await looseDb.rpc("business_foundation_ready");
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

// ---- Owner actions --------------------------------------------------------------------------
export const submitBusiness = (id: string) => rpc("submit_business", { p_id: id });
export const appealBusiness = (id: string, message: string) =>
  rpc("appeal_business", { p_id: id, p_message: message });
export const requestBusinessTier = (id: string) => rpc("request_business_tier", { p_id: id });
export const submitBusinessRevision = (id: string, fields: Record<string, unknown>) =>
  rpc<string>("submit_business_revision", { p_id: id, p_fields: fields });
export const withdrawBusinessRevision = (revisionId: string) =>
  rpc("withdraw_business_revision", { p_revision: revisionId });

export type BusinessRevision = {
  id: string;
  business_id: string;
  proposed: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reason: string | null;
  submitted_at: string;
};

export async function fetchOpenRevision(businessId: string): Promise<BusinessRevision | null> {
  const { data, error } = await looseDb
    .from("business_revisions")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data as BusinessRevision[] | null) ?? [])[0] ?? null;
}

export type TierRequest = {
  id: string;
  business_id: string;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  created_at: string;
};

export async function fetchOpenTierRequest(businessId: string): Promise<TierRequest | null> {
  const { data, error } = await looseDb
    .from("business_tier_requests")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data as TierRequest[] | null) ?? [])[0] ?? null;
}

export type ApprovalLogEntry = {
  id: string;
  business_id: string;
  kind: string;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
};

export async function fetchApprovalLog(businessId: string): Promise<ApprovalLogEntry[]> {
  const { data, error } = await looseDb
    .from("business_approval_log")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return (data as ApprovalLogEntry[] | null) ?? [];
}

// ---- Admin actions --------------------------------------------------------------------------
export const adminReviewBusiness = (
  id: string,
  decision: "approved" | "needs_changes" | "rejected" | "reopen",
  reason?: string,
) => rpc("admin_review_business", { p_id: id, p_decision: decision, p_reason: reason ?? null });
export const setBusinessSuspended = (id: string, suspend: boolean, reason?: string) =>
  rpc("set_business_suspended", { p_id: id, p_suspend: suspend, p_reason: reason ?? null });
export const adminReviewTierRequest = (
  requestId: string,
  decision: "approved" | "rejected",
  reason?: string,
) =>
  rpc("admin_review_tier_request", {
    p_request: requestId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
export const adminReviewRevision = (
  revisionId: string,
  decision: "approved" | "rejected",
  reason?: string,
) =>
  rpc("admin_review_revision", {
    p_revision: revisionId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
export const adminReviewPhoto = (photoId: string, decision: "approved" | "rejected") =>
  rpc("admin_review_photo", { p_photo: photoId, p_decision: decision });
export const adminResolvePhotoReport = (reportId: string, decision: "upheld" | "dismissed") =>
  rpc("admin_resolve_photo_report", { p_report: reportId, p_decision: decision });
export const adminConfirmLegacyBusiness = (id: string) =>
  rpc("admin_confirm_legacy_business", { p_id: id });

export type QueueBusiness = {
  id: string;
  name: string;
  category: string;
  town: string | null;
  description: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  approval_status: ApprovalStatus;
  review_reason: string | null;
  appeal_message: string | null;
  legacy_approved: boolean;
  submitted_at: string | null;
  created_at: string;
};

async function listBusinesses(
  filter: (q: ReturnType<typeof looseDb.from>) => ReturnType<typeof looseDb.from>,
): Promise<QueueBusiness[]> {
  const base = looseDb.from("businesses").select("*");
  const { data, error } = await filter(base).order("created_at", { ascending: true }).limit(100);
  if (error) throw new Error(error.message);
  return (data as QueueBusiness[] | null) ?? [];
}

export const fetchBusinessesByApproval = (status: ApprovalStatus) =>
  listBusinesses((q) => q.eq("approval_status", status));
export const fetchLegacyBusinesses = () => listBusinesses((q) => q.eq("legacy_approved", true));

export async function fetchPendingRevisions(): Promise<
  (BusinessRevision & { businesses: { name: string } | null })[]
> {
  const { data, error } = await looseDb
    .from("business_revisions")
    .select("*, businesses(name)")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as (BusinessRevision & { businesses: { name: string } | null })[] | null) ?? [];
}

export async function fetchPendingTierRequests(): Promise<
  (TierRequest & { businesses: { name: string } | null })[]
> {
  const { data, error } = await looseDb
    .from("business_tier_requests")
    .select("*, businesses(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as (TierRequest & { businesses: { name: string } | null })[] | null) ?? [];
}

export type AdminPhoto = {
  id: string;
  url: string;
  caption: string;
  business_id: string;
  businesses: { name: string } | null;
};

export async function fetchPendingPhotos(): Promise<AdminPhoto[]> {
  const { data, error } = await looseDb
    .from("business_photos")
    .select("id, url, caption, business_id, businesses(name)")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as AdminPhoto[] | null) ?? [];
}

export type PhotoReport = {
  id: string;
  reason: string;
  details: string;
  created_at: string;
  business_photos: {
    id: string;
    url: string;
    business_id: string;
    businesses: { name: string } | null;
  } | null;
};

export async function fetchOpenPhotoReports(): Promise<PhotoReport[]> {
  const { data, error } = await looseDb
    .from("business_photo_reports")
    .select(
      "id, reason, details, created_at, business_photos(id, url, business_id, businesses(name))",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data as PhotoReport[] | null) ?? [];
}

// ---- Followers (a count only; the list of followers is never exposed) --------------------------
export async function fetchBusinessFollowerCount(businessId: string): Promise<number> {
  return Number(await rpc<number>("business_follower_count", { p_business: businessId })) || 0;
}

export async function fetchIsFollowingBusiness(
  userId: string,
  businessId: string,
): Promise<boolean> {
  const { data, error } = await looseDb
    .from("business_follows")
    .select("business_id")
    .eq("follower_user_id", userId)
    .eq("business_id", businessId)
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data as unknown[] | null) ?? []).length > 0;
}

export async function followBusiness(userId: string, businessId: string) {
  const { error } = await looseDb
    .from("business_follows")
    .insert({ follower_user_id: userId, business_id: businessId });
  if (error && !/duplicate|23505/i.test(error.message)) throw new Error(error.message);
}

export async function unfollowBusiness(userId: string, businessId: string) {
  const { error } = await looseDb
    .from("business_follows")
    .delete()
    .eq("follower_user_id", userId)
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
}

// ---- Photo reports ---------------------------------------------------------------------------
export const PHOTO_REPORT_REASONS: [string, string][] = [
  ["inappropriate", "Inappropriate or offensive"],
  ["not_this_business", "Not this business"],
  ["misleading", "Misleading"],
  ["copyright", "Someone else's photo"],
  ["other", "Something else"],
];

export async function reportBusinessPhoto(
  photoId: string,
  userId: string,
  reason: string,
  details: string,
) {
  const { error } = await looseDb
    .from("business_photo_reports")
    .insert({ photo_id: photoId, reporter_id: userId, reason, details: details.slice(0, 1000) });
  if (error)
    throw new Error(
      /duplicate|23505/i.test(error.message) ? "You've already reported this photo" : error.message,
    );
}
