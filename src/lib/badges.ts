import { useQuery } from "@tanstack/react-query";
import { looseDb } from "@/lib/looseDb";

// Badges (0069): collected by doing things on RevMate. Awarded by
// award_my_badges() when the app opens; each one sends a notification.

export const BADGES: Record<string, { label: string; emoji: string; how: string }> = {
  first_post: { label: "First post", emoji: "✍️", how: "Shared a first post" },
  regular: { label: "Regular", emoji: "📣", how: "25 posts" },
  garage_started: { label: "Garage started", emoji: "🏠", how: "Added a car to the garage" },
  crowd_pleaser: { label: "Crowd pleaser", emoji: "🔥", how: "50 likes on posts" },
  fan_favourite: { label: "Fan favourite", emoji: "❤️", how: "A car with 25 likes" },
  streak_7: { label: "7-day streak", emoji: "📅", how: "Opened RevMate 7 days running" },
  streak_30: { label: "30-day streak", emoji: "🗓️", how: "Opened RevMate 30 days running" },
  meet_regular: { label: "Meet regular", emoji: "🏁", how: "Going to 3 meets" },
  helping_hand: { label: "Helping hand", emoji: "🔧", how: "Helped on 5 car problems" },
  seller: { label: "Seller", emoji: "💷", how: "Listed something for sale" },
  car_of_the_week: { label: "Car of the Week", emoji: "👑", how: "Won Car of the Week" },
  challenge_winner: { label: "Challenge winner", emoji: "🏆", how: "Won a weekly challenge" },
};

export const BADGE_ORDER = Object.keys(BADGES);

export async function awardMyBadges(): Promise<string[]> {
  const { data, error } = await looseDb.rpc("award_my_badges");
  if (error) return [];
  return (data as string[] | null) ?? [];
}

export function useBadges(userId: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await looseDb
        .from("user_badges")
        .select("badge, earned_at")
        .eq("user_id", userId);
      if (error) return [];
      return data as { badge: string; earned_at: string }[];
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data ?? [];
}
