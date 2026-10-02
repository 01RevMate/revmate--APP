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

export async function fetchPublicProfile(username: string): Promise<PublicProfileResult> {
  const { data, error } = await supabase.rpc("public_profile", {
    target_username: decodeURIComponent(username),
  });
  if (error) return { status: "unavailable" };
  const row = data?.[0];
  return row
    ? { status: "public", userId: row.user_id, username: row.username }
    : { status: "private" };
}
