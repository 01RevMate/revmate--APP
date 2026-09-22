import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canonicalApprovedVehicleMake, isApprovedVehicleMake } from "@/lib/approvedVehicleMakes";
import { resolvePostPhotos, POST_SELECT, type PostWithAuthor } from "@/lib/posts";

export type CommunityGroup = Tables<"community_groups">;
export type GroupMember = Tables<"group_members">;
export type GroupMembershipWithProfile = GroupMember & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
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
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
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
  settings: Pick<CommunityGroup, "rules" | "post_policy">,
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
