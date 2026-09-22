import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchPost, fetchMyLikedPostIds } from "@/lib/posts";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";

export const Route = createFileRoute("/posts/$postId")({
  component: PostPage,
  head: () => ({
    meta: [
      { title: "Discussion — RevMate" },
      { name: "description", content: "Read a RevMate community discussion, comments and photos." },
      { property: "og:title", content: "Discussion — RevMate" },
      { property: "og:description", content: "Read a RevMate community discussion, comments and photos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
function PostPage() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const {
    data: post,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["post", postId, user?.id],
    queryFn: () => fetchPost(postId),
    refetchInterval: 240000,
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
