import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchFeed, fetchMyLikedPostIds } from "@/lib/posts";
import { Sidebar } from "@/components/Sidebar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevMate — Research, discuss and trade UK cars" },
      {
        name: "description",
        content:
          "RevMate gives every UK car model and generation one page: specs, common faults, MOT data, parts, discussion and listings.",
      },
      { property: "og:title", content: "RevMate — Research, discuss and trade UK cars" },
      {
        property: "og:description",
        content:
          "Specs, common faults, MOT data, discussion and listings for every UK car generation.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(),
  });

  const { data: likedIds } = useQuery({
    queryKey: ["feed", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () => fetchMyLikedPostIds(user!.id, posts!.map((p) => p.id)),
    enabled: !!user && !!posts && posts.length > 0,
  });

  function refreshFeed() {
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <div className="mx-auto flex max-w-5xl gap-6 px-4 py-6">
      <Sidebar />
      <main className="min-w-0 flex-1 space-y-4 pb-16">
        <PostComposer onPosted={refreshFeed} />

        {isLoading && <p className="text-sm text-muted-foreground">Loading feed…</p>}

        {!isLoading && posts?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No posts yet — be the first to share something.
          </div>
        )}

        {posts?.map((post) => (
          <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
        ))}
      </main>
    </div>
  );
}
