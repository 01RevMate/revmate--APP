import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FollowProfile = Pick<Tables<"profiles">, "user_id" | "username" | "avatar_url">;

export type SocialCounts = {
  posts: number;
  followers: number;
  following: number;
  cars: number;
};

export type AccountAnalytics = {
  followers_total: number;
  following_total: number;
  posts_total: number;
  profile_views_7d: number;
  profile_views_30d: number;
  new_followers_30d: number;
  likes_received_30d: number;
  comments_received_30d: number;
};

export async function fetchIsFollowing(followerId: string, followedId: string) {
  const { data, error } = await supabase
    .from("profile_follows")
    .select("follower_id")
    .eq("follower_id", followerId)
    .eq("followed_id", followedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followProfile(followerId: string, followedId: string) {
  const { error } = await supabase
    .from("profile_follows")
    .insert({ follower_id: followerId, followed_id: followedId });
  if (error) throw error;
}

export async function unfollowProfile(followerId: string, followedId: string) {
  const { error } = await supabase
    .from("profile_follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followed_id", followedId);
  if (error) throw error;
}

export async function fetchFollowers(userId: string): Promise<FollowProfile[]> {
  const { data, error } = await supabase
    .from("profile_follows")
    .select("profile:profiles!profile_follows_follower_id_fkey(user_id, username, avatar_url)")
    .eq("followed_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.profile).filter(Boolean) as unknown as FollowProfile[];
}

export async function fetchFollowing(userId: string): Promise<FollowProfile[]> {
  const { data, error } = await supabase
    .from("profile_follows")
    .select("profile:profiles!profile_follows_followed_id_fkey(user_id, username, avatar_url)")
    .eq("follower_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => row.profile).filter(Boolean) as unknown as FollowProfile[];
}

export async function fetchSocialCounts(userId: string): Promise<SocialCounts> {
  const [followers, following, posts, cars] = await Promise.all([
    supabase
      .from("profile_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", userId),
    supabase
      .from("profile_follows")
      .select("followed_id", { count: "exact", head: true })
      .eq("follower_id", userId),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("garage_cars")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("ownership_status", "current"),
  ]);
  for (const result of [followers, following, posts, cars]) {
    if (result.error) throw result.error;
  }
  return {
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    posts: posts.count ?? 0,
    cars: cars.count ?? 0,
  };
}

export async function recordProfileView(userId: string) {
  const { error } = await supabase.rpc("record_profile_view", { target_user_id: userId });
  if (error) throw error;
}

export async function fetchAccountAnalytics(): Promise<AccountAnalytics> {
  const { data, error } = await supabase.rpc("account_analytics");
  if (error) throw error;
  const row = data?.[0];
  return {
    followers_total: Number(row?.followers_total ?? 0),
    following_total: Number(row?.following_total ?? 0),
    posts_total: Number(row?.posts_total ?? 0),
    profile_views_7d: Number(row?.profile_views_7d ?? 0),
    profile_views_30d: Number(row?.profile_views_30d ?? 0),
    new_followers_30d: Number(row?.new_followers_30d ?? 0),
    likes_received_30d: Number(row?.likes_received_30d ?? 0),
    comments_received_30d: Number(row?.comments_received_30d ?? 0),
  };
}
