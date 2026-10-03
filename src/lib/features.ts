import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// New features ship in the app before their SQL has been run on the
// database (see PENDING_SQL.md). A probe checks whether its migration has
// landed, so the UI hides a feature until the database supports it instead
// of showing buttons that error. Once the SQL is live the probe just returns
// true (no network check) — the hooks stay so callers don't need touching.

/** Meets, comment replies, saved posts, reposts, polls, videos (0031 — live). */
export function useSocialFeatures(): boolean {
  return true;
}

/** True once 0032_push_notifications.sql has been applied. */
export function usePushFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "push"],
    queryFn: async () => !(await supabase.from("push_subscriptions").select("id").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

/** For You, Battles, Revs, Pit Stops, streaks, challenges, reactions (0033 — live). */
export function useEngagementFeatures(): boolean {
  return true;
}

/** Group entry rules and questions (0036 — live). */
export function useGroupRulesFeature(): boolean {
  return true;
}

/** Group cover images (0052 — live). */
export function useGroupCoversFeature(): boolean {
  return true;
}

/** Pop-up announcements (0038 — live). */
export function useAnnouncementsFeature(): boolean {
  return true;
}
