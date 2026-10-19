import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { looseDb } from "@/lib/looseDb";

// Launch kit (0063_launch_kit.sql): in-app feedback, admin launch stats and
// Founding member badges for the first 100 accounts.

const db = looseDb;

export const FOUNDING_SPOTS = 100;

/** Spots left for the Founding member badge, or null until the SQL has run. */
export function useFoundingSpotsLeft(): number | null {
  const { data } = useQuery({
    queryKey: ["founding-spots-left"],
    queryFn: async () => {
      const { data, error } = await db.rpc("founding_spots_left");
      return error || typeof data !== "number" ? null : data;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data ?? null;
}

/** True once the launch kit SQL has landed (founding_spots_left answers). */
export function useLaunchKitFeature(): boolean {
  return useFoundingSpotsLeft() !== null;
}

/** Someone's Founding member number (1–100), or null if they aren't one. */
export function useFoundingNumber(userId: string | null | undefined): number | null {
  const { data } = useQuery({
    queryKey: ["founding-number", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await db
        .from("founding_members")
        .select("number")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return null;
      return (data as { number: number }).number;
    },
    staleTime: Infinity,
    retry: false,
  });
  return data ?? null;
}

// ---------- Feedback ----------

export type FeedbackKind = "bug" | "idea" | "other";

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Something's broken" },
  { value: "idea", label: "Idea" },
  { value: "other", label: "Other" },
];

export type AppFeedback = {
  id: string;
  user_id: string;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  status: "new" | "done";
  created_at: string;
  profiles?: { username: string } | null;
};

export async function sendFeedback(kind: FeedbackKind, message: string, page: string) {
  // No .select(): members can send feedback but can't read it back.
  const { error } = await db
    .from("app_feedback")
    .insert({ kind, message: message.trim(), page: page.slice(0, 200) });
  if (error) throw new Error(error.message);
}

export async function fetchFeedback(): Promise<AppFeedback[]> {
  const { data, error } = await db
    .from("app_feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const rows = data as AppFeedback[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return rows;
  const { data: people } = await supabase
    .from("profiles")
    .select("user_id, username")
    .in("user_id", ids);
  const names = new Map((people ?? []).map((p) => [p.user_id, p.username]));
  return rows.map((r) => ({
    ...r,
    profiles: names.has(r.user_id) ? { username: names.get(r.user_id)! } : null,
  }));
}

export async function setFeedbackStatus(id: string, status: "new" | "done") {
  const { error } = await db.from("app_feedback").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteFeedback(id: string) {
  const { error } = await db.from("app_feedback").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Launch stats ----------

export type LaunchStats = {
  members: number;
  joined_today: number;
  joined_7d: number;
  joined_30d: number;
  active_today: number;
  active_7d: number;
  posts_7d: number;
  listings_7d: number;
  messages_7d: number;
  feedback_new: number;
  founding_left: number;
};

export async function fetchLaunchStats(): Promise<LaunchStats> {
  const { data, error } = await db.rpc("admin_launch_stats");
  if (error) throw new Error(error.message);
  return data as LaunchStats;
}
