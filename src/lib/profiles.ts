import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  fields: Partial<Pick<Profile, "username" | "avatar_url" | "cover_photo_url" | "persona">>,
) {
  const { error } = await supabase.from("profiles").update(fields).eq("user_id", userId);
  if (error) throw error;
}
