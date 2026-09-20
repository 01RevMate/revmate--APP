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
  fields: Partial<
    Pick<
      Profile,
      | "username"
      | "avatar_url"
      | "cover_photo_url"
      | "persona"
      | "social_instagram"
      | "social_facebook"
      | "social_tiktok"
    >
  >,
) {
  const { error } = await supabase.from("profiles").update(fields).eq("user_id", userId);
  if (error) throw error;
}

export type SocialPlatformKey = "social_instagram" | "social_facebook" | "social_tiktok";

export const SOCIAL_PLATFORMS: {
  key: SocialPlatformKey;
  label: string;
  placeholder: string;
  validate: (url: string) => boolean;
}[] = [
  {
    key: "social_instagram",
    label: "Instagram",
    placeholder: "https://www.instagram.com/yourpage",
    validate: (url) => /instagram\.com\//i.test(url),
  },
  {
    key: "social_facebook",
    label: "Facebook",
    placeholder: "https://www.facebook.com/yourpage",
    validate: (url) => /facebook\.com\//i.test(url),
  },
  {
    key: "social_tiktok",
    label: "TikTok",
    placeholder: "https://www.tiktok.com/@yourpage",
    validate: (url) => /tiktok\.com\//i.test(url),
  },
];
