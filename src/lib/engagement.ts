import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { POST_SELECT, resolvePostPhotos, type PostWithAuthor } from "@/lib/posts";
import type { CarMeet } from "@/lib/meets";

// Data helpers for the engagement pack (0033_engagement.sql). Callers only
// use these once useEngagementFeatures() says the SQL has landed.

// ---------- For You feed & onboarding ----------

export async function fetchForYouFeed(category: string, offset = 0): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .rpc("for_you_feed", { page_offset: offset, filter_category: category })
    .select(POST_SELECT);
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

export async function fetchSuggestedProfiles(limit = 12) {
  const { data, error } = await supabase.rpc("suggested_profiles", { result_limit: limit });
  if (error) throw error;
  return data;
}

export async function completeOnboarding(userId: string, favouriteMakes: string[]) {
  const { error } = await supabase
    .from("profiles")
    .update({ favourite_makes: favouriteMakes, onboarded_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}

// ---------- App-open "pulse": streak, recaps, rank alerts, weekly crown ----------

export async function runDailyPulse() {
  const [streak] = await Promise.all([
    supabase.rpc("record_daily_activity"),
    supabase.rpc("send_my_weekly_recap"),
    supabase.rpc("check_my_rank_changes"),
    supabase.rpc("crown_car_of_the_week"),
  ]);
  return streak.data?.[0] ?? null;
}

// ---------- Levels ----------

export type ProfileLevel = {
  xp: number;
  level_name: string;
  level_floor: number;
  next_level_at: number | null;
};

export async function fetchProfileLevel(userId: string): Promise<ProfileLevel | null> {
  const { data, error } = await supabase.rpc("profile_level", { target_user: userId });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ---------- Car Battles & Car of the Week ----------

export type BattleCar = {
  id: string;
  user_id: string;
  username: string;
  nickname: string;
  make: string;
  model: string;
  year: number | null;
  photo_url: string;
  battle_wins: number;
  battle_losses: number;
};

export async function fetchBattle(excludeIds: string[]): Promise<BattleCar[]> {
  const { data, error } = await supabase.rpc("next_car_battle", { exclude_ids: excludeIds });
  if (error) throw error;
  return data;
}

export async function voteBattle(winner: string, loser: string) {
  const { error } = await supabase.rpc("vote_car_battle", { winner, loser });
  if (error) throw error;
}

export type CarOfTheWeek = {
  week_start: string;
  wins: number;
  garage_cars: {
    id: string;
    nickname: string;
    make: string;
    model: string;
    photo_url: string | null;
    profiles: { username: string } | null;
  } | null;
};

export async function fetchCarOfTheWeek(): Promise<CarOfTheWeek | null> {
  const { data, error } = await supabase
    .from("car_of_the_week")
    .select(
      "week_start, wins, garage_cars(id, nickname, make, model, photo_url, profiles!garage_cars_user_id_fkey(username))",
    )
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as CarOfTheWeek | null;
}

// ---------- Revs ----------

export async function fetchRevs(offset = 0): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .rpc("revs_feed", { page_offset: offset })
    .select(POST_SELECT);
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

// ---------- Stories ----------

export type Story = Tables<"stories"> & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
};

export async function fetchLiveStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*, profiles!stories_user_id_fkey(username, avatar_url)")
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw error;
  return data as unknown as Story[];
}

export async function fetchMyViewedStoryIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("story_views")
    .select("story_id")
    .eq("viewer_id", userId)
    .gte("viewed_at", new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString());
  if (error) throw error;
  return new Set(data.map((row) => row.story_id));
}

export async function createStory(input: {
  userId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
}) {
  const { error } = await supabase.from("stories").insert({
    user_id: input.userId,
    media_url: input.mediaUrl,
    media_type: input.mediaType,
    caption: input.caption.trim() || null,
  });
  if (error) throw error;
}

export async function markStoryViewed(storyId: string, userId: string) {
  await supabase
    .from("story_views")
    .upsert(
      { story_id: storyId, viewer_id: userId },
      { onConflict: "story_id,viewer_id", ignoreDuplicates: true },
    );
}

export async function deleteStory(storyId: string) {
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}

// ---------- Weekly challenges ----------

export type Challenge = Tables<"challenges">;

export async function fetchActiveChallenge(): Promise<Challenge | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .lte("starts_on", today)
    .gte("ends_on", today)
    .order("starts_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchChallenges(): Promise<Challenge[]> {
  const { data, error } = await supabase
    .from("challenges")
    .select("*")
    .order("starts_on", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function createChallenge(input: {
  userId: string;
  tag: string;
  title: string;
  description: string;
  startsOn: string;
  endsOn: string;
}) {
  const { error } = await supabase.from("challenges").insert({
    tag: input.tag.replace(/^#/, "").toLowerCase(),
    title: input.title.trim(),
    description: input.description.trim(),
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    created_by: input.userId,
  });
  if (error) throw error;
}

export async function setChallengeWinner(challengeId: string, postId: string | null) {
  const { error } = await supabase
    .from("challenges")
    .update({ winner_post_id: postId })
    .eq("id", challengeId);
  if (error) throw error;
}

export async function deleteChallenge(challengeId: string) {
  const { error } = await supabase.from("challenges").delete().eq("id", challengeId);
  if (error) throw error;
}

// ---------- Near you ----------

/** Rounded to 2 decimal places (~1km) so exact locations never leave the phone. */
export function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

export function getApproximateLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location isn't available on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: roundCoordinate(position.coords.latitude),
          lng: roundCoordinate(position.coords.longitude),
        }),
      () => reject(new Error("Allow location access to see what's near you.")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

export async function fetchNearbyMeets(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<CarMeet[]> {
  const { data, error } = await supabase.rpc("nearby_meets", { lat, lng, radius_km: radiusKm });
  if (error) throw error;
  return data;
}

export async function fetchNearbyPosts(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .rpc("nearby_posts", { lat, lng, radius_km: radiusKm })
    .select(POST_SELECT);
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Free OpenStreetMap lookup so a meet's address can be placed on the Near you map. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const results = (await response.json()) as { lat: string; lon: string }[];
    const first = results[0];
    return first ? { lat: Number(first.lat), lng: Number(first.lon) } : null;
  } catch {
    return null;
  }
}

// ---------- Reactions ----------

export type Reaction = "like" | "fire" | "love" | "wow" | "haha";

export const REACTIONS: { id: Reaction; emoji: string; label: string }[] = [
  { id: "like", emoji: "❤️", label: "Like" },
  { id: "fire", emoji: "🔥", label: "Fire" },
  { id: "love", emoji: "😍", label: "Love" },
  { id: "wow", emoji: "🤯", label: "Wow" },
  { id: "haha", emoji: "😂", label: "Haha" },
];

export async function fetchMyReaction(postId: string, userId: string): Promise<Reaction | null> {
  const { data, error } = await supabase
    .from("post_likes")
    .select("reaction")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.reaction as Reaction | undefined) ?? null;
}

export async function setReaction(
  postId: string,
  userId: string,
  reaction: Reaction,
  hadLike: boolean,
) {
  const { error } = hadLike
    ? await supabase
        .from("post_likes")
        .update({ reaction })
        .eq("post_id", postId)
        .eq("user_id", userId)
    : await supabase.from("post_likes").insert({ post_id: postId, user_id: userId, reaction });
  if (error) throw error;
}

// ---------- Notification settings ----------

export type NotificationSettings = Tables<"notification_settings">;

export async function fetchNotificationSettings(
  userId: string,
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNotificationSettings(
  userId: string,
  settings: { quiet_hours: boolean; muted_kinds: string[] },
) {
  const { error } = await supabase
    .from("notification_settings")
    .upsert(
      { user_id: userId, ...settings, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}

// ---------- New posts pill ----------

/** How many public posts have appeared since the newest one on screen. */
export async function countNewerPosts(sinceIso: string): Promise<number> {
  const { count, error } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .is("group_id", null)
    .eq("audience", "public")
    .eq("moderation_status", "published")
    .gt("created_at", sinceIso);
  if (error) return 0;
  return count ?? 0;
}

export async function setMeetLocation(meetId: string, lat: number, lng: number) {
  const { error } = await supabase
    .from("car_meets")
    .update({ latitude: lat, longitude: lng })
    .eq("id", meetId);
  if (error) throw error;
}
