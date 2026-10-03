import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useEngagementFeatures } from "@/lib/features";
import { runDailyPulse } from "@/lib/engagement";

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
    void runDailyPulse().then(() => {
      if (cancelled) return;
      queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
    });
    return () => {
      cancelled = true;
    };
  }, [user, enabled, queryClient]);

  return null;
}
