import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Car } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { fetchFeed, fetchMyLikedPostIds, type PostWithAuthor } from "@/lib/posts";
import { fetchGarage } from "@/lib/garage";
import { CarLogo } from "@/components/CarLogo";
import { Sidebar } from "@/components/Sidebar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";
import { FeedScopeBar, type FeedScope } from "@/components/FeedScopeBar";
import { CategoryFilterBar, type CategoryFilter } from "@/components/CategoryFilterBar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UK Car Research, Common Faults, Specs & Marketplace | RevMate" },
      {
        name: "description",
        content:
          "Research UK cars by model and generation. Compare specs, common faults, MOT insights, owner advice, parts and cars for sale on RevMate.",
      },
      {
        property: "og:title",
        content: "UK Car Research, Common Faults, Specs & Marketplace | RevMate",
      },
      {
        property: "og:description",
        content:
          "Research UK cars by model and generation. Compare specs, common faults, MOT insights, owner advice, parts and cars for sale on RevMate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
  const currentCars = useMemo(() => (garage ?? []).filter((c) => c.ownership_status !== "previous"), [garage]);
  // Posting as a specific car pins My Car/Same Brand to that car — no need to ask.
  const activeCar = useMemo(
    () => currentCars.find((c) => c.id === profile?.active_garage_car_id) ?? null,
    [currentCars, profile?.active_garage_car_id],
  );
  const needsCarPrompt =
    !activeCar && currentCars.length > 1 && sessionFilterCarId === null && (scope === "my_car" || scope === "same_brand");

  const filterCars = useMemo(() => {
    if (activeCar) return [activeCar];
    if (currentCars.length <= 1) return currentCars;
    if (sessionFilterCarId && sessionFilterCarId !== "all") {
      return currentCars.filter((c) => c.id === sessionFilterCarId);
    }
    return currentCars; // "all", or still unpicked (prompt is shown instead of results)
  }, [activeCar, currentCars, sessionFilterCarId]);

  const myMakes = useMemo(() => new Set(filterCars.map((c) => c.make.toLowerCase())), [filterCars]);
  const myMakeModels = useMemo(
    () => new Set(filterCars.map((c) => `${c.make.toLowerCase()}::${c.model.toLowerCase()}`)),
    [filterCars],
  );

  const filteredPosts = useMemo(() => {
    if (needsCarPrompt) return [];
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
  }, [posts, scope, category, hasGarageCars, needsCarPrompt, myMakes, myMakeModels]);

  const scopeLabel = useMemo(() => {
    if (scope === "popular") return "Popular this week";
    if (scope === "my_car" || scope === "same_brand") {
      if (activeCar) return `Filtered by ${activeCar.nickname}`;
      if (filterCars.length === 1) return `Filtered by ${filterCars[0]!.nickname}`;
      return "Filtered by your garage";
    }
    return "Global feed";
  }, [scope, activeCar, filterCars]);

  function refreshFeed() {
    queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
          <div>
            <h1 className="text-lg font-semibold">Feed</h1>
            <p className="text-xs text-muted-foreground">{scopeLabel}</p>
          </div>

          <FeedScopeBar scope={scope} onScopeChange={setScope} hasGarageCars={hasGarageCars} />
          <CategoryFilterBar category={category} onCategoryChange={setCategory} />

          <PostComposer onPosted={refreshFeed} />

          {needsCarPrompt && (
            <div className="rounded-lg border border-dashed border-border p-4">
              <p className="text-sm font-medium">Which car do you mean?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                You've got more than one car in the garage — pick one, or look at posts for all of them.
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
                  Look at both
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
                <p className="text-xs text-muted-foreground">See posts from people with the same car as you.</p>
              </div>
            </Link>
          )}

          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)}

          {!isLoading && !needsCarPrompt && filteredPosts.length === 0 && (
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
