import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { POST_SELECT, resolvePostPhotos, type PostWithAuthor } from "@/lib/posts";

// Data helpers for the social features pack (0031_social_features.sql).
// Callers only use these once useSocialFeatures() says the SQL has landed.

// ---------- @mentions and #hashtags ----------

// Mirrors the handle pattern private.notify_mentions() matches server-side.
export const MENTION_PATTERN = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_.]{2,30})/g;
export const HASHTAG_PATTERN = /(^|[^A-Za-z0-9_&])#([A-Za-z][A-Za-z0-9_]{1,39})/g;

export function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").toLowerCase();
}

export async function fetchPostsByTag(tag: string): Promise<PostWithAuthor[]> {
  const clean = normalizeTag(tag).replace(/[^a-z0-9_]/g, "");
  if (!clean) return [];
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .is("group_id", null)
    .ilike("body", `%#${clean}%`)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  // ilike also matches longer tags (#stance matches #stanced), so re-check
  // the exact tag the same way the text is linkified.
  const exact = new RegExp(`(^|[^A-Za-z0-9_&])#${clean}(?![A-Za-z0-9_])`, "i");
  const posts = (data as unknown as PostWithAuthor[]).filter((post) => exact.test(post.body));
  return resolvePostPhotos(posts);
}

export async function searchMentionableProfiles(query: string) {
  const clean = query.replace(/^@+/, "").replace(/[%_,()]/g, "");
  if (clean.length < 1) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, avatar_url")
    .or(`username.ilike.@${clean}%,username.ilike.${clean}%`)
    .eq("account_status", "active")
    .limit(6);
  if (error) throw error;
  return data;
}

// ---------- Comment replies & likes ----------

export async function addCommentReply(
  postId: string,
  userId: string,
  body: string,
  parentId: string | null,
) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, body, parent_id: parentId });
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function fetchMyLikedCommentIds(userId: string, commentIds: string[]) {
  if (commentIds.length === 0) return new Set<string>();
  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", userId)
    .in("comment_id", commentIds);
  if (error) throw error;
  return new Set(data.map((row) => row.comment_id));
}

export async function likeComment(commentId: string, userId: string) {
  const { error } = await supabase
    .from("comment_likes")
    .upsert(
      { comment_id: commentId, user_id: userId },
      { onConflict: "comment_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unlikeComment(commentId: string, userId: string) {
  const { error } = await supabase
    .from("comment_likes")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ---------- Saved posts ----------

export async function savePost(postId: string, userId: string) {
  const { error } = await supabase
    .from("saved_posts")
    .upsert(
      { post_id: postId, user_id: userId },
      { onConflict: "user_id,post_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unsavePost(postId: string, userId: string) {
  const { error } = await supabase
    .from("saved_posts")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchSavedPosts(userId: string): Promise<PostWithAuthor[]> {
  const { data: saved, error } = await supabase
    .from("saved_posts")
    .select("post_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const ids = saved.map((row) => row.post_id);
  if (ids.length === 0) return [];
  const { data, error: postsError } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .in("id", ids);
  if (postsError) throw postsError;
  const byId = new Map((data as unknown as PostWithAuthor[]).map((post) => [post.id, post]));
  // Keep "most recently saved first", and drop posts that have since vanished.
  const ordered = ids.map((id) => byId.get(id)).filter((post): post is PostWithAuthor => !!post);
  return resolvePostPhotos(ordered);
}

// ---------- Reposts ----------

export async function createRepost(userId: string, originalPostId: string, caption: string) {
  const { error } = await supabase.from("posts").insert({
    id: crypto.randomUUID(),
    user_id: userId,
    body: caption.trim(),
    repost_of_id: originalPostId,
    category: "discussion",
    audience: "public",
  });
  if (error) {
    if (error.code === "23505") throw new Error("You've already reposted this.");
    throw error;
  }
}

export async function fetchOriginalPost(id: string): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? (await resolvePostPhotos([data as unknown as PostWithAuthor]))[0]! : null;
}

// ---------- Polls ----------

export type PollOption = Tables<"post_poll_options">;

export const MAX_POLL_OPTIONS = 4;

export async function createPollOptions(
  postId: string,
  options: { label: string; imageUrl?: string | null }[],
) {
  const rows = options
    .map((option, position) => ({
      post_id: postId,
      position,
      label: option.label.trim(),
      image_url: option.imageUrl ?? null,
    }))
    .filter((row) => row.label);
  if (rows.length < 2) throw new Error("A poll needs at least two options.");
  const { error } = await supabase.from("post_poll_options").insert(rows);
  if (error) throw error;
}

export async function fetchPoll(postId: string, userId: string | undefined) {
  const { data: options, error } = await supabase
    .from("post_poll_options")
    .select("*")
    .eq("post_id", postId)
    .order("position");
  if (error) throw error;
  let myOptionId: string | null = null;
  if (userId && options.length > 0) {
    const { data: vote } = await supabase
      .from("post_poll_votes")
      .select("option_id")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    myOptionId = vote?.option_id ?? null;
  }
  return { options, myOptionId };
}

export async function castPollVote(
  postId: string,
  optionId: string,
  userId: string,
  hadVote: boolean,
) {
  const { error } = hadVote
    ? await supabase
        .from("post_poll_votes")
        .update({ option_id: optionId })
        .eq("post_id", postId)
        .eq("user_id", userId)
    : await supabase
        .from("post_poll_votes")
        .insert({ post_id: postId, option_id: optionId, user_id: userId });
  if (error) throw error;
}

export async function removePollVote(postId: string, userId: string) {
  const { error } = await supabase
    .from("post_poll_votes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

// ---------- Verified badges ----------

export type VerifiedType = "club" | "trader" | "creator";

export const VERIFIED_LABELS: Record<VerifiedType, string> = {
  club: "Verified club",
  trader: "Verified trader",
  creator: "Verified creator",
};

/** All verified profiles — a short list, so fetch it once and look up locally. */
export async function fetchVerifiedProfiles(): Promise<Map<string, VerifiedType>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, verified_type")
    .not("verified_type", "is", null)
    .limit(1000);
  if (error) throw error;
  return new Map(
    data
      .filter((row) => row.verified_type)
      .map((row) => [row.user_id, row.verified_type as VerifiedType]),
  );
}

export async function setVerifiedType(userId: string, verifiedType: VerifiedType | null) {
  const { error } = await supabase
    .from("profiles")
    .update({ verified_type: verifiedType })
    .eq("user_id", userId);
  if (error) throw error;
}

// ---------- Spotted ----------

export async function fetchSpottedCar(garageCarId: string) {
  const { data, error } = await supabase
    .from("garage_cars")
    .select("id, nickname, make, model, profiles!garage_cars_user_id_fkey(username)")
    .eq("id", garageCarId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as {
    id: string;
    nickname: string;
    make: string;
    model: string;
    profiles: { username: string } | null;
  } | null;
}

/** Owned cars matching a search, so a spotter can link the owner's car. */
export async function searchGarageCarsForSpotting(query: string) {
  const clean = query.trim().replace(/[%_,()]/g, "");
  if (clean.length < 2) return [];
  const { data, error } = await supabase
    .from("garage_cars")
    .select(
      "id, nickname, make, model, year, photo_url, profiles!garage_cars_user_id_fkey(username)",
    )
    .eq("ownership_status", "current")
    .or(`nickname.ilike.%${clean}%,make.ilike.%${clean}%,model.ilike.%${clean}%`)
    .limit(8);
  if (error) throw error;
  return data as unknown as {
    id: string;
    nickname: string;
    make: string;
    model: string;
    year: number | null;
    photo_url: string | null;
    profiles: { username: string } | null;
  }[];
}

// ---------- Video ----------

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // matches the bucket limit
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return `${file.name} isn't a supported video type (MP4, MOV or WebM).`;
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `${file.name} is over ${MAX_VIDEO_BYTES / (1024 * 1024)}MB.`;
  }
  return null;
}

export async function uploadPostVideo(userId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("post-images")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
}

// ---------- Per-viewer state, fetched once and shared by every post card ----------

export async function fetchMySavedPostIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", userId)
    .limit(2000);
  if (error) throw error;
  return new Set(data.map((row) => row.post_id));
}

export async function fetchMyRepostedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("posts")
    .select("repost_of_id")
    .eq("user_id", userId)
    .not("repost_of_id", "is", null)
    .limit(2000);
  if (error) throw error;
  return new Set(data.map((row) => row.repost_of_id).filter((id): id is string => !!id));
}

export async function undoRepost(originalPostId: string, userId: string) {
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("user_id", userId)
    .eq("repost_of_id", originalPostId);
  if (error) throw error;
}
