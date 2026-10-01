import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { normalizeUsername, usernameLookupCandidates } from "@/lib/usernames";

export type Profile = Tables<"profiles">;

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const candidates = usernameLookupCandidates(username);
  if (candidates.length === 0) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("username", candidates)
    .limit(1)
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
      | "bio"
      | "cover_photo_url"
      | "persona"
      | "social_instagram"
      | "social_facebook"
      | "social_tiktok"
      | "social_youtube"
      | "social_snapchat"
      | "social_x"
    >
  >,
) {
  const nextFields = { ...fields };
  if (typeof nextFields.username === "string") {
    nextFields.username = normalizeUsername(nextFields.username);
  }
  const { error } = await supabase.from("profiles").update(nextFields).eq("user_id", userId);
  if (error) throw error;
}

// null means "post and browse as yourself"; a garage_cars id means posts
// default to that car and the My Car/Same Brand feed scopes use its make/model
// without asking, since the user has told us which car they mean.
export async function setActivePostingIdentity(userId: string, garageCarId: string | null) {
  const { error } = await supabase
    .from("profiles")
    .update({ active_garage_car_id: garageCarId })
    .eq("user_id", userId);
  if (error) throw error;
}

export type SocialPlatformKey =
  | "social_instagram"
  | "social_tiktok"
  | "social_youtube"
  | "social_facebook"
  | "social_snapchat"
  | "social_x";

export type SocialPlatform = {
  key: SocialPlatformKey;
  label: string;
  /** What goes in front of a handle, e.g. instagram.com/ */
  prefix: string;
  /** Turns a typed handle (@name or name) into a profile URL. */
  fromHandle: (handle: string) => string;
  validate: (url: string) => boolean;
  /** Added by 0052; hidden until that SQL has run. */
  extra?: boolean;
};

const host = (pattern: RegExp) => (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && pattern.test(u.hostname) && u.pathname.length > 1;
  } catch {
    return false;
  }
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    key: "social_instagram",
    label: "Instagram",
    prefix: "instagram.com/",
    fromHandle: (h) => `https://www.instagram.com/${h}`,
    validate: host(/(^|\.)instagram\.com$/i),
  },
  {
    key: "social_tiktok",
    label: "TikTok",
    prefix: "tiktok.com/@",
    fromHandle: (h) => `https://www.tiktok.com/@${h}`,
    validate: host(/(^|\.)tiktok\.com$/i),
  },
  {
    key: "social_youtube",
    label: "YouTube",
    prefix: "youtube.com/@",
    fromHandle: (h) => `https://www.youtube.com/@${h}`,
    validate: host(/(^|\.)(youtube\.com|youtu\.be)$/i),
    extra: true,
  },
  {
    key: "social_facebook",
    label: "Facebook",
    prefix: "facebook.com/",
    fromHandle: (h) => `https://www.facebook.com/${h}`,
    validate: host(/(^|\.)(facebook\.com|fb\.com)$/i),
  },
  {
    key: "social_snapchat",
    label: "Snapchat",
    prefix: "snapchat.com/add/",
    fromHandle: (h) => `https://www.snapchat.com/add/${h}`,
    validate: host(/(^|\.)snapchat\.com$/i),
    extra: true,
  },
  {
    key: "social_x",
    label: "X",
    prefix: "x.com/",
    fromHandle: (h) => `https://x.com/${h}`,
    validate: host(/(^|\.)(x\.com|twitter\.com)$/i),
    extra: true,
  },
];

/**
 * Accepts what people actually type — "@dave_gti", "dave_gti", or a full
 * link — and returns a clean https URL (or null if it isn't usable).
 */
export function normaliseSocial(platform: SocialPlatform, input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /\.(com|be)\//i.test(value)) {
    const url = value.replace(/^http:\/\//i, "https://").replace(/^(?!https:\/\/)/i, "https://");
    return platform.validate(url) ? url.slice(0, 300) : null;
  }
  const handle = value.replace(/^@/, "");
  return /^[A-Za-z0-9._-]{1,60}$/.test(handle) ? platform.fromHandle(handle) : null;
}

/** "@dave_gti" from a profile link, for the button label. */
export function socialHandle(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last || ["channel", "c", "user", "add", "profile.php"].includes(last)) return null;
    return last.startsWith("@") ? last : `@${last}`;
  } catch {
    return null;
  }
}

/** YouTube, Snapchat and X links (0052). */
export function useExtraSocialsFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "extra-socials"],
    queryFn: async () => !(await supabase.from("profiles").select("social_youtube").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

/** What to show in the editor box: the handle for standard links, else the link. */
export function socialInputValue(url: string | null | undefined) {
  if (!url) return "";
  const handle = socialHandle(url);
  return handle ? handle.replace(/^@/, "") : url;
}
