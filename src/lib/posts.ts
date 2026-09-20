import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Post = Tables<"posts">;
export type PostComment = Tables<"post_comments">;

export type PostWithAuthor = Post & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
  cars: Pick<Tables<"cars">, "make" | "model" | "generation"> | null;
  posted_as_garage_car: Pick<Tables<"garage_cars">, "id" | "nickname" | "photo_url"> | null;
};

export type CommentWithAuthor = PostComment & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
};

const POST_SELECT =
  "*, profiles!posts_user_id_fkey(username, avatar_url), cars(make, model, generation), posted_as_garage_car:garage_cars!posts_posted_as_garage_car_id_fkey(id, nickname, photo_url)";

export async function fetchFeed(limit = 20): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function fetchPostsByUser(userId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function fetchPostsByGarageCar(garageCarId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("posted_as_garage_car_id", garageCarId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as PostWithAuthor[];
}

export async function fetchMyLikedPostIds(userId: string, postIds: string[]) {
  if (postIds.length === 0) return new Set<string>();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  if (error) throw error;
  return new Set(data.map((row) => row.post_id));
}

export async function createPost(input: {
  userId: string;
  body: string;
  carId?: string | undefined;
  postedAsGarageCarId?: string | undefined;
}) {
  const { error } = await supabase.from("posts").insert({
    user_id: input.userId,
    body: input.body,
    car_id: input.carId || null,
    posted_as_garage_car_id: input.postedAsGarageCarId || null,
  });
  if (error) throw error;
}

export async function likePost(postId: string, userId: string) {
  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  if (error) throw error;
}

export async function unlikePost(postId: string, userId: string) {
  const { error } = await supabase
    .from("post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchComments(postId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("post_comments")
    .select("*, profiles!post_comments_user_id_fkey(username, avatar_url)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as CommentWithAuthor[];
}

export async function addComment(postId: string, userId: string, body: string) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, body });
  if (error) throw error;
}
