import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEngagementFeatures } from "@/lib/features";
import { runDailyPulse } from "@/lib/engagement";
import { toast } from "sonner";
import { awardMyBadges, BADGES } from "@/lib/badges";

/**
 * Once per app open: records today's visit, and lets the database
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
    void runDailyPulse()
      // Badges after the pulse, so today's streak counts.
      .then(() => awardMyBadges())
      .then((earned) => {
        if (cancelled) return;
        for (const code of earned) {
          const b = BADGES[code];
          if (b) toast.success(`${b.emoji} New badge: ${b.label}`, { description: b.how });
        }
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        if (earned.length) queryClient.invalidateQueries({ queryKey: ["badges", user.id] });
      });
    return () => {
      cancelled = true;
    };
  }, [user, enabled, queryClient]);

  return null;
}
