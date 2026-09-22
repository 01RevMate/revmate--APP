import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Car } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { fetchFeed, fetchMyLikedPostIds, type PostWithAuthor } from "@/lib/posts";
import { fetchGarage } from "@/lib/garage";
import { fetchFriends } from "@/lib/friends";
import { CarLogo } from "@/components/CarLogo";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Sidebar } from "@/components/Sidebar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";
import { FeedScopeBar, type FeedScope } from "@/components/FeedScopeBar";
import { CategoryFilterBar, type CategoryFilter } from "@/components/CategoryFilterBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevMate — UK Car Community, Research & Marketplace" },
      {
        name: "description",
        content:
          "The all-in-one automotive social app for UK car enthusiasts. Research models, compare specs, discuss faults, and buy or sell cars and parts.",
      },
      {
        property: "og:title",
        content: "RevMate — UK Car Community, Research & Marketplace",
      },
      {
        property: "og:description",
        content:
          "The all-in-one automotive social app for UK car enthusiasts. Research models, compare specs, discuss faults, and buy or sell cars and parts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "RevMate — UK Car Community, Research & Marketplace",
      },
      {
        name: "twitter:description",
        content:
          "The all-in-one automotive social app for UK car enthusiasts. Research models, compare specs, discuss faults, and buy or sell cars and parts.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<FeedScope>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  // Which car's make/model to use for My Car/Same Brand when posting as
  // yourself with more than one car — null until the person picks one (or
  // "all" to mix every car together, the old behavior).
  const [sessionFilterCarId, setSessionFilterCarId] = useState<string | "all" | null>(null);

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const { data: friends } = useQuery({
    queryKey: ["friends", user?.id],
    enabled: !!user && scope === "friends",
    queryFn: () => fetchFriends(user!.id),
  });

  useEffect(() => {
    if (!user && scope === "friends") setScope("all");
  }, [scope, user]);

  const currentCars = useMemo(
    () => (garage ?? []).filter((c) => c.ownership_status !== "previous"),
    [garage],
  );
  // Posting as a specific car pins My Car/Same Brand to that car — no need to ask.
  const activeCar = useMemo(
    () => currentCars.find((c) => c.id === profile?.active_garage_car_id) ?? null,
    [currentCars, profile?.active_garage_car_id],
  );
  const needsCarPrompt =
    !activeCar &&
    currentCars.length > 1 &&
    sessionFilterCarId === null &&
    (scope === "my_car" || scope === "same_brand");

  const hasGarageCars = currentCars.length > 0;
  const filterCarId =
    activeCar?.id ??
    (sessionFilterCarId && sessionFilterCarId !== "all" ? sessionFilterCarId : null);
  const {
    data: pages,
    isLoading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", user?.id, scope, category, filterCarId],
    queryFn: ({ pageParam }) => fetchFeed(scope, filterCarId, category, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 30 ? allPages.length * 30 : undefined,
    enabled: !needsCarPrompt,
    refetchInterval: 240000,
  });
  const filteredPosts = useMemo(
    () => [...new Map((pages?.pages.flat() ?? []).map((post) => [post.id, post])).values()],
    [pages],
  );
  const { data: likedIds } = useQuery({
    queryKey: ["feed", "liked", user?.id, filteredPosts.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        filteredPosts.map((p) => p.id),
      ),
    enabled: !!user && filteredPosts.length > 0,
  });

  function refreshFeed() {
    return queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <PullToRefresh onRefresh={refreshFeed}>
          <div className="mx-auto max-w-2xl py-4 sm:px-4 sm:py-6">
            <div className="space-y-4 px-3 sm:px-0">
              <FeedScopeBar
                scope={scope}
                onScopeChange={setScope}
                hasGarageCars={hasGarageCars}
                isAuthenticated={!!user}
              />
              <CategoryFilterBar category={category} onCategoryChange={setCategory} />

              {scope === "my_groups" ? (
                <Link
                  to="/groups"
                  className="block rounded-lg border bg-card p-4 text-sm text-primary"
                >
                  Explore your groups or choose a group to post in →
                </Link>
              ) : (
                <PostComposer
                  onPosted={refreshFeed}
                  requiredCarIdentity={scope === "my_car" || scope === "same_brand"}
                  garageCars={currentCars}
                  preferredGarageCarId={
                    activeCar?.id ??
                    (sessionFilterCarId && sessionFilterCarId !== "all" ? sessionFilterCarId : null)
                  }
                  onGarageCarSelected={setSessionFilterCarId}
                  audience={scope === "friends" ? "friends" : "public"}
                />
              )}

              {needsCarPrompt && (
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium">Which car do you mean?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    You've got more than one car in the garage — pick one, or look at posts for all
                    of them.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentCars.map((car) => (
                      <button
                        key={car.id}
                        onClick={() => setSessionFilterCarId(car.id)}
                        className="flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
                      >
                        <CarLogo make={car.make} className="size-4 shrink-0 rounded-full" />
                        {car.nickname}
                      </button>
                    ))}
                    <button
                      onClick={() => setSessionFilterCarId("all")}
                      className="rounded-full border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      All my cars
                    </button>
                  </div>
                </div>
              )}

              {user && !hasGarageCars && (
                <Link
                  to="/garage"
                  className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4 hover:border-primary/60"
                >
                  <Car className="size-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Add a car to unlock the My Car feed</p>
                    <p className="text-xs text-muted-foreground">
                      See posts from people with the same car as you.
                    </p>
                  </div>
                </Link>
              )}

              {feedError && (
                <p role="alert" className="rounded-lg border p-4 text-sm">
                  Could not load discussions.{" "}
                  <button
                    className="text-primary"
                    onClick={() => {
                      refreshFeed();
                      queryClient.invalidateQueries({ queryKey: ["groups"] });
                    }}
                  >
                    Try again
                  </button>
                </p>
              )}
            </div>

            <div className="mt-4 space-y-1 bg-muted/60 sm:space-y-4 sm:bg-transparent">
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} immersive />)}

              {!isLoading && !feedError && !needsCarPrompt && filteredPosts.length === 0 && (
                <div className="mx-3 rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground sm:mx-0">
                  {scope === "my_car"
                    ? "No posts about your car yet — be the first."
                    : scope === "friends" && friends?.length === 0
                      ? "No friends yet — visit another profile to add one."
                      : scope === "friends"
                        ? "No friends-only posts in this category yet."
                        : "No posts here yet — try a different filter."}
                </div>
              )}

              {filteredPosts.map((post: PostWithAuthor) => (
                <PostCard
                  key={post.id}
                  post={post}
                  liked={likedIds?.has(post.id) ?? false}
                  onDeleted={refreshFeed}
                  immersive
                />
              ))}
              {hasNextPage && (
                <div className="bg-background px-3 py-3 sm:p-0">
                  <button
                    disabled={isFetchingNextPage}
                    onClick={() => fetchNextPage()}
                    className="w-full rounded-lg border p-3 text-sm"
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more discussions"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </PullToRefresh>
      </main>
    </div>
  );
}
