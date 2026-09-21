import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ReportReason = Tables<"post_reports">["reason"];
export type PostReport = Tables<"post_reports">;
export type ProtectedTerm = Tables<"protected_post_terms">;

export type ReportWithContext = PostReport & {
  reporter: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
  reported_profile: Pick<
    Tables<"profiles">,
    "username" | "avatar_url" | "account_status" | "role"
  > | null;
  posts: Pick<Tables<"posts">, "id" | "body" | "user_id" | "created_at"> | null;
};

export type ModeratedProfile = Pick<
  Tables<"profiles">,
  | "user_id"
  | "username"
  | "avatar_url"
  | "role"
  | "account_status"
  | "moderation_note"
  | "moderated_at"
  | "created_at"
>;

export type BlockedProfile = {
  id: string;
  created_at: string;
  blocked_id: string;
  blocked_profile: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url"> | null;
};

export async function reportPost(
  postId: string,
  reporterId: string,
  reason: ReportReason,
  details: string,
) {
  const { error } = await supabase.from("post_reports").insert({
    post_id: postId,
    reporter_id: reporterId,
    reason,
    details: details.trim(),
  });
  if (error) throw error;
}

export async function fetchBlock(blockerId: string, blockedId: string) {
  const { data, error } = await supabase
    .from("user_blocks")
    .select("id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function blockProfile(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockProfile(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function fetchBlockedProfiles(blockerId: string): Promise<BlockedProfile[]> {
  const { data, error } = await supabase
    .from("user_blocks")
    .select(
      "id, created_at, blocked_id, blocked_profile:profiles!user_blocks_blocked_id_fkey(user_id, username, avatar_url)",
    )
    .eq("blocker_id", blockerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as BlockedProfile[];
}

export async function fetchAdminReports(): Promise<ReportWithContext[]> {
  const { data, error } = await supabase
    .from("post_reports")
    .select(
      "*, reporter:profiles!post_reports_reporter_id_fkey(username, avatar_url), reported_profile:profiles!post_reports_reported_user_id_fkey(username, avatar_url, account_status, role), posts(id, body, user_id, created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as unknown as ReportWithContext[];
}

export async function fetchAdminProfiles(): Promise<ModeratedProfile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "user_id, username, avatar_url, role, account_status, moderation_note, moderated_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchGarageOwnerIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("garage_cars").select("user_id");
  if (error) throw error;
  return new Set(data.map((row) => row.user_id));
}

export async function reviewReport(id: string, status: "dismissed" | "actioned") {
  const { error } = await supabase.from("post_reports").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function updateAccountAccess(
  userId: string,
  accountStatus: Tables<"profiles">["account_status"],
  moderationNote: string,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ account_status: accountStatus, moderation_note: moderationNote.trim() || null })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateProfileRole(userId: string, role: "user" | "admin") {
  const { error } = await supabase.from("profiles").update({ role }).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchProtectedTerms(): Promise<ProtectedTerm[]> {
  const { data, error } = await supabase
    .from("protected_post_terms")
    .select("*")
    .order("term", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addProtectedTerm(
  adminId: string,
  term: string,
  matchType: "word" | "phrase",
) {
  const { error } = await supabase.from("protected_post_terms").insert({
    created_by: adminId,
    term: term.trim().toLowerCase(),
    match_type: matchType,
  });
  if (error) throw error;
}

export async function setProtectedTermActive(id: string, active: boolean) {
  const { error } = await supabase.from("protected_post_terms").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteProtectedTerm(id: string) {
  const { error } = await supabase.from("protected_post_terms").delete().eq("id", id);
  if (error) throw error;
}
