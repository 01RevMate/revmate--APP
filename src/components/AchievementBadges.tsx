import { useQuery } from "@tanstack/react-query";
import { fetchProfileStats, unlockedAchievements } from "@/lib/achievements";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function AchievementBadges({ userId }: { userId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["profile-stats", userId],
    queryFn: () => fetchProfileStats(userId),
  });

  if (!stats) return null;
  const achievements = unlockedAchievements(stats);
  if (achievements.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {achievements.map((a) => (
        <Tooltip key={a.id}>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium">
              <span>{a.emoji}</span>
              {a.name}
            </span>
          </TooltipTrigger>
          <TooltipContent>{a.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
