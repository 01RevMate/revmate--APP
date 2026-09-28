import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// New features ship in the app before their SQL has been run on the
// database (see PENDING_SQL.md). Each probe checks whether its migration
// has landed, so the UI simply hides a feature until the database supports
// it instead of showing buttons that error.

async function tableExists(
  table: "car_meets" | "push_subscriptions" | "stories" | "group_questions",
): Promise<boolean> {
  const { error } = await supabase.from(table).select("id").limit(1);
  return !error;
}

/**
 * True once 0031_social_features.sql has been applied: meets, comment
 * replies and likes, saved posts, reposts, polls, spotted posts, video
 * uploads and verified badges all ship in that one transaction.
 */
export function useSocialFeatures(): boolean {
  return useSocialFeaturesStatus() === "on";
}

/** Like useSocialFeatures, but tells "still checking" apart from "not yet". */
export function useSocialFeaturesStatus(): "checking" | "on" | "off" {
  const { data } = useQuery({
    queryKey: ["feature", "social-pack"],
    queryFn: () => tableExists("car_meets"),
    staleTime: Infinity,
    retry: false,
  });
  if (data === undefined) return "checking";
  return data ? "on" : "off";
}

/** True once 0032_push_notifications.sql has been applied. */
export function usePushFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "push"],
    queryFn: () => tableExists("push_subscriptions"),
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

/**
 * True once 0033_engagement.sql has been applied: For You feed, onboarding,
 * Car Battles, recaps, streaks & levels, Revs, Stories, challenges, Near
 * you, reactions and notification settings all ship in that transaction.
 */
export function useEngagementFeatures(): boolean {
  return useEngagementFeaturesStatus() === "on";
}

export function useEngagementFeaturesStatus(): "checking" | "on" | "off" {
  const { data } = useQuery({
    queryKey: ["feature", "engagement-pack"],
    queryFn: () => tableExists("stories"),
    staleTime: Infinity,
    retry: false,
  });
  if (data === undefined) return "checking";
  return data ? "on" : "off";
}

/**
 * True once 0036_group_rules.sql has been applied: group entry rules (same
 * brand / same car), entry questions, rules agreement and the no-sales
 * setting. Until then groups keep working exactly as before.
 */
export function useGroupRulesFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "group-rules"],
    queryFn: () => tableExists("group_questions"),
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}
