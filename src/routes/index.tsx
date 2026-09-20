import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Car } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchFeed, fetchMyLikedPostIds, type PostWithAuthor } from "@/lib/posts";
import { fetchGarage } from "@/lib/garage";
import { Sidebar } from "@/components/Sidebar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";
import { FeedScopeBar, type FeedScope } from "@/components/FeedScopeBar";
import { CategoryFilterBar, type CategoryFilter } from "@/components/CategoryFilterBar";

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

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Home() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<FeedScope>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["feed"],
    queryFn: () => fetchFeed(50),
  });

  const { data: likedIds } = useQuery({
    queryKey: ["feed", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () => fetchMyLikedPostIds(user!.id, posts!.map((p) => p.id)),
    enabled: !!user && !!posts && posts.length > 0,
  });

  const hasGarageCars = !!garage && garage.length > 0;
  const myMakes = useMemo(() => new Set((garage ?? []).map((c) => c.make.toLowerCase())), [garage]);
  const myMakeModels = useMemo(
    () => new Set((garage ?? []).map((c) => `${c.make.toLowerCase()}::${c.model.toLowerCase()}`)),
    [garage],
  );

  const filteredPosts = useMemo(() => {
    let result = posts ?? [];

    if (scope === "my_car" && hasGarageCars) {
      result = result.filter(
        (p) => p.cars && myMakeModels.has(`${p.cars.make.toLowerCase()}::${p.cars.model.toLowerCase()}`),
      );
    } else if (scope === "same_brand" && hasGarageCars) {
      result = result.filter((p) => p.cars && myMakes.has(p.cars.make.toLowerCase()));
    } else if (scope === "popular") {
      const cutoff = Date.now() - ONE_WEEK_MS;
      result = result
        .filter((p) => new Date(p.created_at).getTime() >= cutoff)
        .slice()
        .sort((a, b) => b.likes_count - a.likes_count);
    }
    // "all" and disabled "my_groups" fall through with no scope filter

    if (category !== "all") {
      result = result.filter((p) => p.category === category);
    }

    return result;
  }, [posts, scope, category, hasGarageCars, myMakes, myMakeModels]);

  const scopeLabel = useMemo(() => {
    if (scope === "popular") return "Popular this week";
    if (scope === "my_car" || scope === "same_brand") return "Filtered by your garage";
    return "Global feed";
  }, [scope]);

  function refreshFeed() {
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-16">
          <div>
            <h1 className="text-lg font-semibold">Feed</h1>
            <p className="text-xs text-muted-foreground">{scopeLabel}</p>
          </div>

          <FeedScopeBar scope={scope} onScopeChange={setScope} hasGarageCars={hasGarageCars} />
          <CategoryFilterBar category={category} onCategoryChange={setCategory} />

          <PostComposer onPosted={refreshFeed} />

          {user && !hasGarageCars && (
            <Link
              to="/garage"
              className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 hover:border-primary/60"
            >
              <Car className="size-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">Add a car to unlock the My Car feed</p>
                <p className="text-xs text-muted-foreground">See posts from people with the same car as you.</p>
              </div>
            </Link>
          )}

          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)}

          {!isLoading && filteredPosts.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {scope === "my_car"
                ? "No posts about your car yet — be the first."
                : "No posts here yet — try a different filter."}
            </div>
          )}

          {filteredPosts.map((post: PostWithAuthor) => (
            <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
          ))}
        </div>
      </main>
    </div>
  );
}
