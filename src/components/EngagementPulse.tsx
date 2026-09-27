import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEngagementFeatures } from "@/lib/features";
import { runDailyPulse } from "@/lib/engagement";

/**
 * Once per app open: records today's visit (streak), and lets the database
 * send anything that's due — your weekly recap, rank-up alerts and last
 * week's Car of the Week. There's no server scheduler; each of these is
 * safe to call repeatedly and only ever fires once.
 */
export function EngagementPulse() {
  const { user } = useAuth();
  const enabled = useEngagementFeatures();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !enabled) return;
    let cancelled = false;
    void runDailyPulse().then((streak) => {
      if (cancelled) return;
      if (streak) queryClient.setQueryData(["streak", user.id], streak);
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    });
    return () => {
      cancelled = true;
    };
  }, [user, enabled, queryClient]);

  return null;
}

/** Small flame with your current daily streak, for the top bar. */
export function StreakBadge() {
  const { user } = useAuth();
  const enabled = useEngagementFeatures();
  const { data } = useQuery<{ current_streak: number; longest_streak: number } | null>({
    queryKey: ["streak", user?.id],
    queryFn: () => null,
    enabled: false,
    staleTime: Infinity,
  });
  if (!user || !enabled || !data || data.current_streak < 1) return null;
  const days = data.current_streak;
  return (
    <span
      className="flex items-center gap-0.5 rounded-full bg-orange-500/10 px-2 py-1 text-xs font-bold text-orange-600"
      title={`${days}-day streak — open RevMate each day to keep it going (best: ${data.longest_streak})`}
      aria-label={`${days} day streak`}
    >
      <Flame className="size-3.5" fill="currentColor" />
      {days}
    </span>
  );
}
