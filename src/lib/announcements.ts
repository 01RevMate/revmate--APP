import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { LATEST_RELEASE } from "@/lib/changelog";

export type Announcement = Tables<"announcements">;
export type AnnouncementDraft = Pick<
  TablesInsert<"announcements">,
  | "kind"
  | "release_version"
  | "title"
  | "body"
  | "image_url"
  | "cta_label"
  | "cta_url"
  | "audience"
  | "starts_at"
  | "ends_at"
  | "active"
>;

export const AUDIENCE_LABELS: Record<string, string> = {
  everyone: "Everyone",
  adults: "18 and over",
  under_18: "Under 18s",
};

/** A ready-made "What's new" announcement from the newest app release. */
export function updateTemplate(): AnnouncementDraft {
  return {
    kind: "update",
    release_version: LATEST_RELEASE.version,
    title: `What's new in RevMate ${LATEST_RELEASE.version}: ${LATEST_RELEASE.title}`,
    body: LATEST_RELEASE.highlights
      .slice(0, 6)
      .map((line) => `• ${line}`)
      .join("\n"),
    image_url: null,
    cta_label: "See all updates",
    cta_url: "/legal/updates",
    audience: "everyone",
    starts_at: new Date().toISOString(),
    ends_at: null,
    active: true,
  };
}

export function blankTemplate(): AnnouncementDraft {
  return {
    kind: "custom",
    release_version: null,
    title: "",
    body: "",
    image_url: null,
    cta_label: null,
    cta_url: null,
    audience: "everyone",
    starts_at: new Date().toISOString(),
    ends_at: null,
    active: true,
  };
}

/** The newest live announcement this person hasn't seen yet, if any. */
export async function fetchNextAnnouncement(userId: string): Promise<Announcement | null> {
  // RLS only returns live announcements meant for this person.
  const [{ data: live, error }, { data: seen }] = await Promise.all([
    supabase.from("announcements").select("*").order("starts_at", { ascending: false }).limit(20),
    supabase.from("announcement_views").select("announcement_id").eq("user_id", userId),
  ]);
  if (error) return null;
  const seenIds = new Set((seen ?? []).map((row) => row.announcement_id));
  const now = Date.now();
  return (
    live.find(
      (a) =>
        a.active &&
        !seenIds.has(a.id) &&
        new Date(a.starts_at).getTime() <= now &&
        (!a.ends_at || new Date(a.ends_at).getTime() > now),
    ) ?? null
  );
}

export async function markAnnouncementSeen(id: string, userId: string, clicked: boolean) {
  const { error } = await supabase
    .from("announcement_views")
    .upsert(
      { announcement_id: id, user_id: userId, clicked },
      { onConflict: "announcement_id,user_id" },
    );
  if (error) throw error;
}

export async function fetchAllAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchAnnouncementStats(): Promise<
  Record<string, { seen: number; clicked: number }>
> {
  const { data, error } = await supabase.rpc("announcement_stats");
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [
      row.announcement_id,
      { seen: Number(row.seen), clicked: Number(row.clicked) },
    ]),
  );
}

export async function saveAnnouncement(draft: AnnouncementDraft, id?: string) {
  const row = {
    ...draft,
    title: draft.title.trim(),
    body: draft.body.trim(),
    cta_label: draft.cta_label?.trim() || null,
    cta_url: draft.cta_label?.trim() ? draft.cta_url?.trim() || null : null,
  };
  const { error } = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert({ ...row, id: crypto.randomUUID() });
  if (error) throw error;
}

export async function setAnnouncementActive(id: string, active: boolean) {
  const { error } = await supabase.from("announcements").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}
