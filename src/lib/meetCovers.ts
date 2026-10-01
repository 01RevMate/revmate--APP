import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl } from "@/lib/seo";

// Cover images for meets: the organiser's own photo, one they've used on a
// past meet, or one of RevMate's ready-made designs (public/meet-covers).
// Meets without a cover get a matching design picked from their title.

export type CoverOption = { url: string; label: string };

export const MEET_COVER_DESIGNS: (CoverOption & { keywords: RegExp })[] = [
  {
    url: "/meet-covers/night.jpg",
    label: "Night meet",
    keywords: /night|neon|late|evening|after dark/i,
  },
  {
    url: "/meet-covers/coffee.jpg",
    label: "Cars & coffee",
    keywords: /coffee|breakfast|brunch|morning|sunday/i,
  },
  {
    url: "/meet-covers/track.jpg",
    label: "Track day",
    keywords: /track|circuit|trackday|race|sprint|drag|motorsport/i,
  },
  {
    url: "/meet-covers/show.jpg",
    label: "Show & shine",
    keywords: /show|shine|concours|display|expo|awards?/i,
  },
  {
    url: "/meet-covers/cruise.jpg",
    label: "Cruise",
    keywords: /cruise|drive|run|tour|road ?trip|convoy|mountain|pass/i,
  },
  {
    url: "/meet-covers/city.jpg",
    label: "City meet",
    keywords: /city|town|retail|car park|carpark|centre|center/i,
  },
];

const isDesign = (url: string) => url.startsWith("/meet-covers/");

/** A design that suits the meet, so meets without a photo still look good. */
export function autoMeetCover(meet: { id: string; title: string }): string {
  const match = MEET_COVER_DESIGNS.find((d) => d.keywords.test(meet.title));
  if (match) return match.url;
  const hash = [...meet.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return MEET_COVER_DESIGNS[hash % MEET_COVER_DESIGNS.length]!.url;
}

export function meetCoverSrc(meet: { id: string; title: string; cover_url: string | null }) {
  return meet.cover_url || autoMeetCover(meet);
}

/** For link previews: designs live on our own site, so make them absolute. */
export function meetShareImage(meet: { id: string; title: string; cover_url: string | null }) {
  const src = meetCoverSrc(meet);
  return src.startsWith("/") ? absoluteUrl(src) : src;
}

/** Photos the organiser has used on their earlier meets (newest first). */
export async function fetchMyPastMeetCovers(userId: string): Promise<CoverOption[]> {
  const { data, error } = await supabase
    .from("car_meets")
    .select("title, cover_url, starts_at")
    .eq("organizer_id", userId)
    .not("cover_url", "is", null)
    .order("starts_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const seen = new Set<string>();
  return data.flatMap((m) => {
    if (!m.cover_url || isDesign(m.cover_url) || seen.has(m.cover_url)) return [];
    seen.add(m.cover_url);
    return [{ url: m.cover_url, label: m.title }];
  });
}

export async function updateMeetCover(meetId: string, coverUrl: string | null) {
  const { error } = await supabase
    .from("car_meets")
    .update({ cover_url: coverUrl })
    .eq("id", meetId);
  if (error) throw error;
}
