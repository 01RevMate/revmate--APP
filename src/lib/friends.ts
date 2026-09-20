import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Friendship = Tables<"friendships">;

export type FriendshipWithProfile = Friendship & {
  requester: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;
  recipient: Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;
};

const FRIENDSHIP_SELECT =
  "*, requester:profiles!friendships_requester_id_fkey(user_id, username, avatar_url), recipient:profiles!friendships_recipient_id_fkey(user_id, username, avatar_url)";

export async function fetchFriendshipBetween(
  userIdA: string,
  userIdB: string,
): Promise<Friendship | null> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(
      `and(requester_id.eq.${userIdA},recipient_id.eq.${userIdB}),and(requester_id.eq.${userIdB},recipient_id.eq.${userIdA})`,
    )
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchFriends(userId: string): Promise<FriendshipWithProfile[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(FRIENDSHIP_SELECT)
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`);
  if (error) throw error;
  return data as unknown as FriendshipWithProfile[];
}

export async function fetchPendingRequests(userId: string): Promise<FriendshipWithProfile[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(FRIENDSHIP_SELECT)
    .eq("status", "pending")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as FriendshipWithProfile[];
}

export async function sendFriendRequest(requesterId: string, recipientId: string) {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, recipient_id: recipientId });
  if (error) throw error;
}

export async function acceptFriendRequest(id: string) {
  const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
  if (error) throw error;
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) throw error;
}
