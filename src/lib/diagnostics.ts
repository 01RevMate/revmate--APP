import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { POST_SELECT, resolvePostPhotos, type PostWithAuthor } from "@/lib/posts";

// Smart diagnostic posts (0045): which part of the car the problem is in,
// resolved / unresolved with the fix, and common issues per car.

export const ISSUE_SYSTEMS: { id: string; label: string; emoji: string }[] = [
  { id: "engine", label: "Engine", emoji: "🔧" },
  { id: "gearbox", label: "Gearbox / clutch", emoji: "⚙️" },
  { id: "electrical", label: "Electrics", emoji: "⚡" },
  { id: "bodywork", label: "Bodywork", emoji: "🚗" },
  { id: "suspension", label: "Suspension", emoji: "🛞" },
  { id: "brakes", label: "Brakes", emoji: "🛑" },
  { id: "cooling", label: "Cooling", emoji: "🌡️" },
  { id: "exhaust", label: "Exhaust / emissions", emoji: "💨" },
  { id: "fuel", label: "Fuel system", emoji: "⛽" },
  { id: "steering", label: "Steering", emoji: "🎯" },
  { id: "tyres_wheels", label: "Tyres / wheels", emoji: "⭕" },
  { id: "interior", label: "Interior", emoji: "💺" },
  { id: "software", label: "Software / infotainment", emoji: "📱" },
  { id: "audio", label: "Speakers / Sound", emoji: "🔊" },
  { id: "other", label: "Something else", emoji: "❓" },
];

export function issueSystemLabel(id: string | null | undefined) {
  const system = ISSUE_SYSTEMS.find((s) => s.id === id);
  return system ? `${system.emoji} ${system.label}` : null;
}

export function issueSystemName(id: string | null | undefined) {
  return ISSUE_SYSTEMS.find((system) => system.id === id)?.label ?? null;
}

/** True once 0045 has been applied. */
export function useDiagnosticsFeature(): boolean {
  return true;
}

export async function setIssueStatus(
  postId: string,
  status: "resolved" | "unresolved",
  fix?: string | null,
) {
  const { error } = await supabase
    .from("posts")
    .update({
      issue_status: status,
      ...(status === "resolved" ? { issue_fix: fix?.trim() || null } : {}),
    })
    .eq("id", postId);
  if (error) throw error;
}

export async function fetchCommonIssues(make: string, model?: string | null) {
  const { data, error } = await supabase.rpc("common_issues", {
    for_make: make,
    ...(model ? { for_model: model } : {}),
  });
  if (error) throw error;
  return data.map((row) => ({
    ...row,
    reports: Number(row.reports),
    resolved: Number(row.resolved),
  }));
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/** The make/model a post is about (tagged car, the car it was posted as, or catalogue car). */
export function postCar(post: PostWithAuthor): { make: string | null; model: string | null } {
  const tagged = post as PostWithAuthor & {
    tagged_make?: string | null;
    tagged_model?: string | null;
  };
  return {
    make: tagged.tagged_make ?? post.posted_as_garage_car?.make ?? post.cars?.make ?? null,
    model: tagged.tagged_model ?? post.posted_as_garage_car?.model ?? post.cars?.model ?? null,
  };
}

/** Diagnostic posts, optionally for one car and/or system, fixed ones first. */
export async function fetchIssuePosts(filters: {
  make?: string;
  model?: string;
  system?: string;
  resolvedOnly?: boolean;
}): Promise<PostWithAuthor[]> {
  let query = supabase
    .from("posts")
    .select(POST_SELECT)
    .not("issue_status", "is", null)
    .is("group_id", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (filters.system) query = query.eq("issue_system", filters.system);
  if (filters.resolvedOnly) query = query.eq("issue_status", "resolved");
  const { data, error } = await query;
  if (error) throw error;
  const posts = (data as unknown as PostWithAuthor[]).filter((post) => {
    const car = postCar(post);
    if (filters.make && norm(car.make) !== norm(filters.make)) return false;
    if (filters.model && norm(car.model) !== norm(filters.model)) return false;
    return true;
  });
  posts.sort(
    (a, b) =>
      Number(b.issue_status === "resolved") - Number(a.issue_status === "resolved") ||
      b.created_at.localeCompare(a.created_at),
  );
  return resolvePostPhotos(posts);
}
