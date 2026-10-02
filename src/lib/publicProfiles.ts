import { supabase } from "@/integrations/supabase/client";

// Public profile pages (0055_public_profiles.sql): adults' profiles and
// garages can be seen signed out and appear in Google. Under-18s and
// accounts whose age we don't know stay behind the sign-in screen.

export const PROFILE_PAGE = /^\/u\/([^/]+)(?:\/cars\/[^/]+)?\/?$/;

export type PublicProfileResult =
  | { status: "public"; userId: string; username: string }
  | { status: "private" }
  /** The SQL hasn't run yet — keep the old (signed-in only) behaviour. */
  | { status: "unavailable" };

// Called without the generated types on purpose: Lovable regenerates
// types.ts from the live database, and until 0055 runs these functions
// aren't in it — that must not break the build.
type LooseRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
export const looseRpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

export async function fetchPublicProfile(username: string): Promise<PublicProfileResult> {
  const { data: raw, error } = await looseRpc("public_profile", {
    target_username: decodeURIComponent(username),
  });
  const data = raw as { user_id: string; username: string }[] | null;
  if (error) return { status: "unavailable" };
  const row = data?.[0];
  return row
    ? { status: "public", userId: row.user_id, username: row.username }
    : { status: "private" };
}
