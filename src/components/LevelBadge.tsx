import { useQuery } from "@tanstack/react-query";
import { Flame, Gauge } from "lucide-react";
import { useEngagementFeatures } from "@/lib/features";
import { fetchProfileLevel } from "@/lib/engagement";

const LEVEL_COLOURS: Record<string, string> = {
  Learner: "from-slate-500 to-slate-400",
  Enthusiast: "from-sky-600 to-cyan-500",
  Petrolhead: "from-orange-600 to-amber-500",
  Legend: "from-fuchsia-600 to-purple-500",
};

/** Level (Learner → Enthusiast → Petrolhead → Legend), XP progress and streak. */
export function LevelBadge({ userId, streak }: { userId: string; streak?: number | null }) {
  const enabled = useEngagementFeatures();
  const { data: level } = useQuery({
    queryKey: ["profile-level", userId],
    queryFn: () => fetchProfileLevel(userId),
    enabled,
    staleTime: 5 * 60_000,
  });
  if (!enabled || !level) return null;

  const span = level.next_level_at ? level.next_level_at - level.level_floor : 1;
  const progress = level.next_level_at ? (level.xp - level.level_floor) / span : 1;

  return (
    <div className="mt-3 flex max-w-sm items-center gap-3">
      <span
        className={`flex items-center gap-1 rounded-full bg-gradient-to-r px-2.5 py-1 text-xs font-bold text-white ${LEVEL_COLOURS[level.level_name] ?? LEVEL_COLOURS["Learner"]}`}
      >
        <Gauge className="size-3.5" />
        {level.level_name}
      </span>
      <div className="min-w-0 flex-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.max(4, Math.min(100, progress * 100))}%` }}
          />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {level.xp.toLocaleString("en-GB")} XP
          {level.next_level_at &&
            ` · ${(level.next_level_at - level.xp).toLocaleString("en-GB")} to next level`}
        </p>
      </div>
      {!!streak && streak > 1 && (
        <span
          className="flex items-center gap-0.5 text-xs font-bold text-orange-600"
          title={`${streak}-day streak`}
        >
          <Flame className="size-3.5" fill="currentColor" />
          {streak}
        </span>
      )}
    </div>
  );
}
