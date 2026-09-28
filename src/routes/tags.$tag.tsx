import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Hash } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyLikedPostIds } from "@/lib/posts";
import { fetchPostsByTag, normalizeTag } from "@/lib/social";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";

export const Route = createFileRoute("/tags/$tag")({
  head: ({ params }) => {
    const tag = normalizeTag(params.tag);
    const title = `#${tag} — RevMate`;
    const description = `Posts tagged #${tag} on RevMate, the UK car community.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: TagPage,
});

function TagPage() {
  const { tag: rawTag } = Route.useParams();
  const tag = normalizeTag(rawTag);
  const { user } = useAuth();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts-by-tag", tag],
    queryFn: () => fetchPostsByTag(tag),
  });
  const { data: likedIds } = useQuery({
    queryKey: ["posts-by-tag", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts!.map((p) => p.id),
      ),
    enabled: !!user && !!posts && posts.length > 0,
  });

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link to="/" className="text-sm text-primary">
        ← Back to the feed
      </Link>
      <header className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Hash className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">#{tag}</h1>
          {posts && (
            <p className="text-sm text-muted-foreground">
              {posts.length} {posts.length === 1 ? "post" : "posts"}
            </p>
          )}
        </div>
      </header>
      {isLoading && <PostCardSkeleton />}
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
      ))}
      {posts?.length === 0 && (
        <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">
          No posts tagged #{tag} yet. Add #{tag} to a post to start it off.
        </p>
      )}
    </main>
  );
}
