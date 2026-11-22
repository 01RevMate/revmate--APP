import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchPostSeo } from "@/lib/seoData";
import { postHead } from "@/lib/seoHeads";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loadForSsr } from "@/lib/ssrLoad";
import { useAuth } from "@/hooks/useAuth";
import { fetchPost, fetchMyLikedPostIds } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";

export const Route = createFileRoute("/posts/$postId")({
  component: PostPage,
  // The link-preview tags and the post itself both load here, so the first HTML (what Google reads)
  // already contains the post. A slow database falls back to loading in the browser.
  loader: async ({ params }) => {
    const [seoData, full] = await Promise.all([
      fetchPostSeo(params.postId),
      loadForSsr(() => fetchPost(params.postId)),
    ]);
    return { seoData, full };
  },
  head: ({ params, loaderData }) => postHead(params.postId, loaderData?.seoData ?? null),
});
function PostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const { full } = Route.useLoaderData();
  const {
    data: post,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["post", postId, user?.id],
    queryFn: () => fetchPost(postId),
    refetchInterval: 240000,
    ...(full.ok ? { initialData: full.data } : {}),
    // Signing in changes the query key; keep showing the server's copy while the signed-in one loads.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const { data: liked } = useQuery({
    queryKey: ["post", postId, "liked", user?.id],
    queryFn: () => fetchMyLikedPostIds(user!.id, [postId]),
    enabled: !!user && !!post,
  });
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link to="/" className="text-sm text-primary">
        ← Back to discussions
      </Link>
      {isLoading && <PostCardSkeleton />}
      {error && (
        <p role="alert">
          Could not load this post.{" "}
          <button onClick={() => refetch()} className="text-primary">
            Try again
          </button>
        </p>
      )}
      {!isLoading && !error && !post && (
        <div className="rounded-lg border p-5">
          <p>This post is unavailable. It may have been removed or belong to a private group.</p>
          <Link to="/groups" className="mt-3 block text-primary">
            Find your groups
          </Link>
          {!user && (
            <Link to="/login" className="mt-3 block text-primary">
              Sign in to view member discussions
            </Link>
          )}
        </div>
      )}
      {post && (
        <PostCard
          key={`${post.id}-${liked?.has(post.id)}`}
          post={post}
          liked={liked?.has(post.id) ?? false}
          onDeleted={() => refetch()}
        />
      )}
    </main>
  );
}
