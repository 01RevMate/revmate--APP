import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// New features ship in the app before their SQL has been run on the
// database (see PENDING_SQL.md). Each probe checks whether its migration
// has landed, so the UI simply hides a feature until the database supports
// it instead of showing buttons that error.

async function tableExists(table: "car_meets" | "push_subscriptions"): Promise<boolean> {
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
