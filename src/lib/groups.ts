import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canonicalApprovedVehicleMake, isApprovedVehicleMake } from "@/lib/approvedVehicleMakes";
import { resolvePostPhotos, POST_SELECT, type PostWithAuthor } from "@/lib/posts";

export type CommunityGroup = Tables<"community_groups">;
export type GroupMember = Tables<"group_members">;
export type GroupMembershipWithProfile = GroupMember & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
};

export type GroupQuestion = Tables<"group_questions">;
export type GroupEntryRule = "open" | "same_brand" | "same_model";
export type GroupRulesSettings = {
  entry_rule: GroupEntryRule;
  allow_sales: boolean;
  require_rules_agreement: boolean;
};
/** A question being written in the create/edit forms (no id until saved). */
export type GroupQuestionDraft = {
  kind: "agree" | "yes_no" | "text";
  prompt: string;
  required_answer: "yes" | "no" | null;
};
export type GroupRulesDraft = GroupRulesSettings & {
  rules_text: string;
  questions: GroupQuestionDraft[];
};

export const EMPTY_GROUP_RULES: GroupRulesDraft = {
  entry_rule: "open",
  allow_sales: true,
  require_rules_agreement: false,
  rules_text: "",
  questions: [],
};

export type GroupJoinAnswer = {
  question_id: string;
  kind: GroupQuestionDraft["kind"];
  prompt: string;
  answer: string;
};

export type MyGroupMembership = GroupMember & {
  community_groups: CommunityGroup | null;
};

export async function fetchGroups(): Promise<CommunityGroup[]> {
  const { data, error } = await supabase
    .from("community_groups")
    .select("*")
    .order("member_count", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.filter((group) => !group.make_name || isApprovedVehicleMake(group.make_name));
}

export async function fetchGroupBySlug(slug: string): Promise<CommunityGroup | null> {
  const { data, error } = await supabase
    .from("community_groups")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (data?.make_name && !isApprovedVehicleMake(data.make_name)) return null;
  return data;
}

export async function fetchMyMembership(
  groupId: string,
  userId: string,
): Promise<GroupMember | null> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchMyGroups(userId: string): Promise<MyGroupMembership[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*, community_groups(*)")
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("requested_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as MyGroupMembership[]).filter(
    (membership) =>
      !membership.community_groups?.make_name ||
      isApprovedVehicleMake(membership.community_groups.make_name),
  );
}

export async function createGroup(
  ownerId: string,
  input: Pick<
    CommunityGroup,
    "name" | "description" | "visibility" | "join_policy" | "post_policy"
  > & {
    make_name?: string | undefined;
    model_name?: string | undefined;
  },
  // Only passed once 0036_group_rules.sql has run (useGroupRulesFeature).
  rules?: GroupRulesSettings & { rules_text: string; questions: GroupQuestionDraft[] },
): Promise<CommunityGroup> {
  const requestedMake = input.make_name?.trim() || null;
  const approvedMake = canonicalApprovedVehicleMake(requestedMake);
  if (requestedMake && !approvedMake) throw new Error("Choose an approved vehicle make.");

  const baseSlug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug || "group"}-${crypto.randomUUID().slice(0, 6)}`;
  const { data, error } = await supabase
    .from("community_groups")
    .insert({
      owner_id: ownerId,
      name: input.name.trim(),
      slug,
      description: input.description.trim(),
      visibility: input.visibility,
      join_policy: input.join_policy,
      post_policy: input.post_policy,
      make_name: approvedMake,
      model_name: input.model_name?.trim() || null,
      ...(rules
        ? {
            entry_rule: rules.entry_rule,
            allow_sales: rules.allow_sales,
            require_rules_agreement: rules.require_rules_agreement,
          }
        : {}),
    })
    .select("*")
    .single();
  if (error) throw error;
  if (rules) {
    // Rules text and questions are owner edits, made once the owner
    // membership exists.
    if (rules.rules_text.trim()) {
      await updateGroupSettings(data.id, { rules: rules.rules_text.trim() });
    }
    if (rules.questions.length > 0) await saveGroupQuestions(data.id, rules.questions);
  }
  return data;
}

/** "BMW M3" / "BMW" for groups with an entry rule, otherwise null. */
export function groupRuleLabel(group: CommunityGroup): string | null {
  const rule = (group.entry_rule ?? "open") as GroupEntryRule;
  if (rule === "same_model" && group.make_name && group.model_name) {
    return `${group.make_name} ${group.model_name}`;
  }
  if (rule === "same_brand" && group.make_name) return group.make_name;
  return null;
}

const normaliseCarWord = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Mirrors private.car_meets_group_rule in 0036_group_rules.sql. */
export function carMatchesGroup(
  car: { make: string; model: string; ownership_status?: string | null },
  group: CommunityGroup,
): boolean {
  if (car.ownership_status && car.ownership_status !== "current") return false;
  const rule = (group.entry_rule ?? "open") as GroupEntryRule;
  if (rule === "open") return true;
  const carMake = canonicalApprovedVehicleMake(car.make) ?? car.make;
  const groupMake = canonicalApprovedVehicleMake(group.make_name) ?? group.make_name;
  if (normaliseCarWord(carMake) !== normaliseCarWord(groupMake)) return false;
  return (
    rule === "same_brand" || normaliseCarWord(car.model) === normaliseCarWord(group.model_name)
  );
}

export async function fetchGroupQuestions(groupId: string): Promise<GroupQuestion[]> {
  const { data, error } = await supabase
    .from("group_questions")
    .select("*")
    .eq("group_id", groupId)
    .order("position")
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Replaces the group's entry questions with this list, in order. */
export async function saveGroupQuestions(groupId: string, questions: GroupQuestionDraft[]) {
  const { error: deleteError } = await supabase
    .from("group_questions")
    .delete()
    .eq("group_id", groupId);
  if (deleteError) throw deleteError;
  const rows = questions
    .filter((question) => question.prompt.trim().length >= 3)
    .map((question, position) => ({
      id: crypto.randomUUID(),
      group_id: groupId,
      position,
      kind: question.kind,
      prompt: question.prompt.trim(),
      required_answer: question.kind === "yes_no" ? question.required_answer : null,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("group_questions").insert(rows);
  if (error) throw error;
}

export async function fetchEntryEligibility(
  groupId: string,
): Promise<{ eligible: boolean; reason: string | null }> {
  const { data, error } = await supabase.rpc("group_entry_eligibility", { gid: groupId });
  if (error) throw error;
  return data[0] ?? { eligible: true, reason: null };
}

/** Joins through the entry-rules checks (0036). Returns the new membership. */
export async function joinGroup(
  groupId: string,
  userId: string,
  answers: Record<string, string>,
  agreed: boolean,
) {
  const { error } = await supabase.rpc("join_group", { gid: groupId, answers, agreed });
  if (error) throw error;
  return fetchMyMembership(groupId, userId);
}

/** Entry answers for the group's pending requests, keyed by user id. */
export async function fetchJoinAnswers(
  groupId: string,
): Promise<Record<string, { answers: GroupJoinAnswer[]; agreed_rules: boolean }>> {
  const { data, error } = await supabase
    .from("group_join_answers")
    .select("user_id, answers, agreed_rules")
    .eq("group_id", groupId);
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [
      row.user_id,
      { answers: row.answers as unknown as GroupJoinAnswer[], agreed_rules: row.agreed_rules },
    ]),
  );
}

export async function requestGroupMembership(groupId: string, userId: string) {
  const { error } = await supabase.rpc("manage_group_member", {
    gid: groupId,
    target_user: userId,
    action: "join",
  });
  if (error) throw error;
  return fetchMyMembership(groupId, userId);
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase.rpc("manage_group_member", {
    gid: groupId,
    target_user: userId,
    action: "leave",
  });
  if (error) throw error;
}

export async function fetchGroupPosts(groupId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

export async function fetchPendingGroupMembers(
  groupId: string,
): Promise<GroupMembershipWithProfile[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*, profiles!group_members_user_id_fkey(username, avatar_url)")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return data as unknown as GroupMembershipWithProfile[];
}

export async function setGroupMembershipStatus(
  groupId: string,
  userId: string,
  status: "approved" | "rejected" | "banned",
) {
  const { error } = await supabase.rpc("manage_group_member", {
    gid: groupId,
    target_user: userId,
    action: status,
  });
  if (error) throw error;
}
export async function setGroupPostStatus(postId: string, status: "published" | "rejected") {
  const { error } = await supabase.rpc("review_group_post", { pid: postId, decision: status });
  if (error) throw error;
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMembershipWithProfile[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("*, profiles!group_members_user_id_fkey(username, avatar_url)")
    .eq("group_id", groupId)
    .order("requested_at");
  if (error) throw error;
  return data as unknown as GroupMembershipWithProfile[];
}

export async function setGroupMemberRole(
  groupId: string,
  userId: string,
  role: "admin" | "moderator" | "member",
) {
  const { error } = await supabase.rpc("manage_group_member", {
    gid: groupId,
    target_user: userId,
    action: role,
  });
  if (error) throw error;
}

export async function updateGroupSettings(
  id: string,
  settings: Partial<
    Pick<
      CommunityGroup,
      | "rules"
      | "post_policy"
      | "join_policy"
      | "entry_rule"
      | "allow_sales"
      | "require_rules_agreement"
      | "make_name"
      | "model_name"
    >
  >,
) {
  const { error } = await supabase.from("community_groups").update(settings).eq("id", id);
  if (error) throw error;
}

export async function fetchGroupReports(groupId: string) {
  const { data, error } = await supabase
    .from("post_reports")
    .select("*, posts!inner(body, group_id)")
    .eq("posts.group_id", groupId)
    .eq("status", "open")
    .order("created_at");
  if (error) throw error;
  return data;
}
