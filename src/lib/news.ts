import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

// RevMate News (0044_revmate_news.sql): official posts from the RevMate
// team shown in everyone's feed at their publish time.

export type NewsPost = Tables<"news_posts">;
export type NewsDraft = Pick<
  TablesInsert<"news_posts">,
  "topic" | "body" | "media" | "cta_label" | "cta_url" | "sponsored" | "published_at" | "active"
>;

/** Topics admins can pick from (or type their own). */
export const NEWS_TOPICS = [
  "App update",
  "News",
  "Sponsored",
  "Fuel prices",
  "Event",
  "Offer",
  "Safety",
  "Motorsport",
];

export function blankNews(): NewsDraft {
  return {
    topic: "News",
    body: "",
    media: [],
    cta_label: null,
    cta_url: null,
    sponsored: false,
    published_at: new Date().toISOString(),
    active: true,
  };
}

/** True once 0044_revmate_news.sql has been applied. */
export function useNewsFeature(): boolean {
  return true;
}

/** Live news for the feed, newest first (RLS hides drafts and scheduled posts). */
export async function fetchLiveNews(): Promise<NewsPost[]> {
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  const now = Date.now();
  return data.filter((n) => n.active && new Date(n.published_at).getTime() <= now);
}

export async function fetchMyNewsLikes(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("news_likes").select("news_id").eq("user_id", userId);
  if (error) throw error;
  return new Set(data.map((row) => row.news_id));
}

export async function setNewsLike(newsId: string, userId: string, liked: boolean) {
  const { error } = liked
    ? await supabase.from("news_likes").insert({ news_id: newsId, user_id: userId })
    : await supabase.from("news_likes").delete().eq("news_id", newsId).eq("user_id", userId);
  if (error) throw error;
}

export async function fetchAllNews(): Promise<NewsPost[]> {
  const { data, error } = await supabase
    .from("news_posts")
    .select("*")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function saveNews(draft: NewsDraft, id?: string) {
  const row = {
    ...draft,
    topic: draft.topic.trim(),
    body: draft.body.trim(),
    cta_label: draft.cta_label?.trim() || null,
    cta_url: draft.cta_label?.trim() ? draft.cta_url?.trim() || null : null,
  };
  const { error } = id
    ? await supabase.from("news_posts").update(row).eq("id", id)
    : await supabase.from("news_posts").insert({ ...row, id: crypto.randomUUID() });
  if (error) throw error;
}

export async function setNewsActive(id: string, active: boolean) {
  const { error } = await supabase.from("news_posts").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteNews(id: string) {
  const { error } = await supabase.from("news_posts").delete().eq("id", id);
  if (error) throw error;
}

type FeedEntry<P> = { kind: "post"; post: P } | { kind: "news"; news: NewsPost };

/**
 * Slots news into a feed by time: each news post goes before the first post
 * older than it, so a new one sits near the top and older ones scroll away.
 * News older than everything loaded only appears once the feed reaches the
 * end, so it never jumps ahead of posts that haven't loaded yet.
 */
export function mergeNewsIntoFeed<P extends { created_at: string }>(
  posts: P[],
  news: NewsPost[],
  reachedEnd: boolean,
): FeedEntry<P>[] {
  const oldestLoaded = posts.reduce<string | null>(
    (oldest, p) => (!oldest || p.created_at < oldest ? p.created_at : oldest),
    null,
  );
  const remaining = [...news]
    .filter((n) => reachedEnd || !oldestLoaded || n.published_at >= oldestLoaded)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  const out: FeedEntry<P>[] = [];
  for (const post of posts) {
    while (remaining.length && remaining[0]!.published_at > post.created_at) {
      out.push({ kind: "news", news: remaining.shift()! });
    }
    out.push({ kind: "post", post });
  }
  for (const n of remaining) out.push({ kind: "news", news: n });
  return out;
}
