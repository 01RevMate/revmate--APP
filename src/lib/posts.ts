import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { uploadImage } from "@/lib/uploads";

export type Post = Tables<"posts">;
export type PostComment = Tables<"post_comments">;

export type PostImage = Tables<"post_images">;

export type PostWithAuthor = Post & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
  cars: Pick<Tables<"cars">, "make" | "model" | "generation"> | null;
  posted_as_garage_car: Pick<
    Tables<"garage_cars">,
    | "id"
    | "nickname"
    | "photo_url"
    | "make"
    | "model"
    | "year"
    | "likes_count"
    | "dislikes_count"
    | "ownership_status"
  > | null;
  listings: Pick<Tables<"listings">, "id" | "price" | "photos" | "status" | "headline"> | null;
  community_groups: Pick<Tables<"community_groups">, "name" | "slug" | "visibility"> | null;
  post_images: Pick<PostImage, "id" | "image_url" | "position">[];
};

export const MAX_IMAGES_PER_POST = 5;

export type CommentWithAuthor = PostComment & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
};

export const POST_CATEGORY_LABELS: Record<Post["category"], string> = {
  discussion: "General Discussion",
  diagnostics: "Diagnostics / Problems",
  modifications: "Modifications",
  bodywork: "Bodywork",
  maintenance: "Maintenance",
  showcase: "Build Showcase",
  for_sale: "For Sale",
};

export const POST_SELECT =
  "*, profiles!posts_user_id_fkey(username, avatar_url), cars(make, model, generation), posted_as_garage_car:garage_cars!posts_posted_as_garage_car_id_fkey(id, nickname, photo_url, make, model, year, likes_count, dislikes_count, ownership_status), listings(id, price, photos, status, headline), post_images(id, image_url, position), community_groups!posts_group_id_fkey(name, slug, visibility)";

export async function fetchFeed(
  scope: string,
  carId: string | null,
  category: string,
  offset = 0,
): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .rpc("community_feed", {
      filter_scope: scope,
      filter_category: category,
      page_offset: offset,
      ...(carId ? { filter_car: carId } : {}),
    })
    .select(POST_SELECT);
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

export async function fetchPostsByUser(userId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .is("group_id", null)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

export async function fetchPostsByCar(carId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .is("group_id", null)
    .eq("car_id", carId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
}

export async function fetchPostsByGarageCar(garageCarId: string): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .is("group_id", null)
    .eq("posted_as_garage_car_id", garageCarId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return resolvePostPhotos(data as unknown as PostWithAuthor[]);
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
  category?: Post["category"] | undefined;
  groupId?: string | undefined;
  audience?: Post["audience"] | undefined;
  listingId?: string | undefined;
}) {
  // Generate the id client-side and skip RETURNING: the visibility policy
  // can't see a brand-new row inside the insert, which made some posts fail.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("posts").insert({
    id,
    user_id: input.userId,
    group_id: input.groupId || null,
    body: input.body,
    car_id: input.carId || null,
    posted_as_garage_car_id: input.postedAsGarageCarId || null,
    category: input.category || "discussion",
    audience: input.groupId ? "public" : (input.audience ?? "public"),
    listing_id: input.listingId || null,
  });
  if (error) throw error;
  return id;
}

export async function uploadPostImage(userId: string, file: File): Promise<string> {
  return uploadImage("post-images", userId, file);
}

export async function attachImagesToPost(postId: string, imageUrls: string[]) {
  if (imageUrls.length === 0) return;
  const { error } = await supabase
    .from("post_images")
    .insert(imageUrls.map((image_url, position) => ({ post_id: postId, image_url, position })));
  if (error) throw error;
}

export async function deletePost(postId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function likePost(postId: string, userId: string) {
  // Idempotent: liking an already-liked post must not error.
  const { error } = await supabase
    .from("post_likes")
    .upsert(
      { post_id: postId, user_id: userId },
      { onConflict: "post_id,user_id", ignoreDuplicates: true },
    );
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

export async function fetchPost(id: string): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? (await resolvePostPhotos([data as unknown as PostWithAuthor]))[0]! : null;
}

export async function resolvePostPhotos(posts: PostWithAuthor[]): Promise<PostWithAuthor[]> {
  return Promise.all(
    posts.map(async (post) => ({
      ...post,
      post_images: await Promise.all(
        post.post_images.map(async (photo) => {
          if (!photo.image_url.startsWith("group-images:")) return photo;
          const { data } = await supabase.storage
            .from("group-images")
            .createSignedUrl(photo.image_url.slice(13), 300);
          return { ...photo, image_url: data?.signedUrl ?? "" };
        }),
      ),
    })),
  );
}

export async function uploadProtectedPostImage(
  userId: string,
  postId: string,
  file: File,
): Promise<string> {
  const path = `${userId}/${postId}/${crypto.randomUUID()}`;
  const { error } = await supabase.storage
    .from("group-images")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return `group-images:${path}`;
}
