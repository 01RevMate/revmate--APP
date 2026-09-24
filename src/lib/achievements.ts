import { supabase } from "@/integrations/supabase/client";

// Simplified from the old app's ACHIEVEMENT_DEFINITIONS + stored-unlock model:
// rather than a separate achievements table with unlock triggers, each
// badge's criterion is computed live from data that already exists, so
// there's nothing new to keep in sync. Trades a little query cost for a lot
// less schema/trigger surface — fine at this scale.
export type Achievement = {
  id: string;
  name: string;
  emoji: string;
  description: string;
};

export const ACHIEVEMENT_DEFINITIONS: (Achievement & {
  check: (stats: ProfileStats) => boolean;
})[] = [
  {
    id: "first_post",
    name: "Community Builder",
    emoji: "📝",
    description: "Made your first post",
    check: (s) => s.postsCount >= 1,
  },
  {
    id: "prolific_poster",
    name: "Prolific Poster",
    emoji: "🗣️",
    description: "Made 5+ posts",
    check: (s) => s.postsCount >= 5,
  },
  {
    id: "modifier",
    name: "Modifier",
    emoji: "⚙️",
    description: "Logged a modification",
    check: (s) => s.modsCount >= 1,
  },
  {
    id: "gearhead",
    name: "Gearhead",
    emoji: "🔧",
    description: "Logged 3+ modifications",
    check: (s) => s.modsCount >= 3,
  },
  {
    id: "showroom_pro",
    name: "Showroom Pro",
    emoji: "📸",
    description: "Uploaded 5+ garage photos",
    check: (s) => s.photosCount >= 5,
  },
  {
    id: "fan_favourite",
    name: "Fan Favourite",
    emoji: "🔥",
    description: "A car in your garage has 10+ likes",
    check: (s) => s.maxCarLikes >= 10,
  },
  {
    id: "well_connected",
    name: "Well Connected",
    emoji: "🤝",
    description: "Gained your first follower",
    check: (s) => s.followersCount >= 1,
  },
];

export type ProfileStats = {
  postsCount: number;
  modsCount: number;
  photosCount: number;
  maxCarLikes: number;
  followersCount: number;
};

export async function fetchProfileStats(userId: string): Promise<ProfileStats> {
  const { data: garageCars, error: garageError } = await supabase
    .from("garage_cars")
    .select("id, likes_count")
    .eq("user_id", userId);
  if (garageError) throw garageError;

  const garageCarIds = garageCars.map((c) => c.id);
  const maxCarLikes = garageCars.reduce((max, c) => Math.max(max, c.likes_count), 0);

  const [postsRes, modsRes, photosRes, followersRes] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    garageCarIds.length > 0
      ? supabase
          .from("garage_mods")
          .select("id", { count: "exact", head: true })
          .in("garage_car_id", garageCarIds)
      : Promise.resolve({ count: 0, error: null }),
    garageCarIds.length > 0
      ? supabase
          .from("garage_car_photos")
          .select("id", { count: "exact", head: true })
          .in("garage_car_id", garageCarIds)
      : Promise.resolve({ count: 0, error: null }),
    supabase
      .from("profile_follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", userId),
  ]);

  if (postsRes.error) throw postsRes.error;
  if (modsRes.error) throw modsRes.error;
  if (photosRes.error) throw photosRes.error;
  if (followersRes.error) throw followersRes.error;

  return {
    postsCount: postsRes.count ?? 0,
    modsCount: modsRes.count ?? 0,
    photosCount: photosRes.count ?? 0,
    maxCarLikes,
    followersCount: followersRes.count ?? 0,
  };
}

export function unlockedAchievements(stats: ProfileStats): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.filter((a) => a.check(stats));
}
