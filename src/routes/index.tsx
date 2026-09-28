import { createFileRoute, Link } from "@tanstack/react-router";
import { DEFAULT_DESCRIPTION, seo, SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Car } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { fetchFeed, fetchMyLikedPostIds, type PostWithAuthor } from "@/lib/posts";
import { fetchForYouFeed } from "@/lib/engagement";
import { useEngagementFeatures } from "@/lib/features";
import { StoriesRow } from "@/components/Stories";
import { FeedHighlights } from "@/components/FeedHighlights";
import { NewPostsPill } from "@/components/NewPostsPill";
import { HomeModeSwitch } from "@/components/HomeModeSwitch";
import { EssentialsHome } from "@/components/EssentialsHome";
import { useHomeMode } from "@/hooks/useHomeMode";
import { fetchGarage } from "@/lib/garage";
import { fetchFollowing } from "@/lib/follows";
import { PullToRefresh } from "@/components/PullToRefresh";
import { Sidebar } from "@/components/Sidebar";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { NewsCard } from "@/components/NewsCard";
import { AdCard } from "@/components/AdCard";
import { fetchAdsForMe, useBusinessesFeature, type AdForMe } from "@/lib/businesses";
import { fetchLiveNews, fetchMyNewsLikes, mergeNewsIntoFeed, useNewsFeature } from "@/lib/news";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";
import { FeedScopeBar, type FeedScope } from "@/components/FeedScopeBar";
import { CategoryFilterBar, type CategoryFilter } from "@/components/CategoryFilterBar";

export const Route = createFileRoute("/")({
  head: () =>
    seo({
      title: `${SITE_NAME} — ${SITE_TAGLINE}`,
      description: DEFAULT_DESCRIPTION,
      path: "/",
    }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const engagement = useEngagementFeatures();
  const [homeMode] = useHomeMode();
  const [scope, setScope] = useState<FeedScope>("all");
  // Once the personalised feed exists, start people on it (once per visit).
  const [scopeTouched, setScopeTouched] = useState(false);
  useEffect(() => {
    if (engagement && !scopeTouched) setScope("for_you");
  }, [engagement, scopeTouched]);
  function changeScope(next: FeedScope) {
    setScopeTouched(true);
    setScope(next);
  }
  const [category, setCategory] = useState<CategoryFilter>("all");
  // A car chosen in the composer also focuses My Car/Same Brand on that car.
  // Until then, the feed can show matches for every current car in the garage.
  const [sessionFilterCarId, setSessionFilterCarId] = useState<string | null>(null);

  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const { data: following } = useQuery({
    queryKey: ["following", user?.id],
    enabled: !!user && scope === "friends",
    queryFn: () => fetchFollowing(user!.id),
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
  const hasGarageCars = currentCars.length > 0;
  const filterCarId = sessionFilterCarId ?? activeCar?.id ?? null;
  const {
    data: pages,
    isLoading,
    error: feedError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", user?.id, scope, category, filterCarId],
    queryFn: ({ pageParam }) =>
      scope === "for_you"
        ? fetchForYouFeed(category, pageParam)
        : fetchFeed(scope, filterCarId, category, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 30 ? allPages.length * 30 : undefined,
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

  // RevMate News sits in every feed at its publish time (not in category filters).
  const newsOn = useNewsFeature();
  const { data: news } = useQuery({
    queryKey: ["news", "live"],
    queryFn: fetchLiveNews,
    enabled: newsOn,
    refetchInterval: 240000,
  });
  const { data: newsLikes } = useQuery({
    queryKey: ["news", "liked", user?.id],
    queryFn: () => fetchMyNewsLikes(user!.id),
    enabled: newsOn && !!user,
  });
  const feedItems = useMemo(
    () =>
      mergeNewsIntoFeed(
        filteredPosts,
        newsOn && category === "all" ? (news ?? []) : [],
        hasNextPage === false,
      ),
    [filteredPosts, news, newsOn, category, hasNextPage],
  );

  // Sponsored cards from the ads manager: one every 8 items, matched to the
  // member's area and cars by the database.
  const businessesOn = useBusinessesFeature();
  const { data: ads } = useQuery({
    queryKey: ["ads", "feed", user?.id],
    queryFn: () => fetchAdsForMe("feed"),
    enabled: businessesOn && !!user,
    staleTime: 10 * 60_000,
  });
  const feedWithAds = useMemo(() => {
    type Item = (typeof feedItems)[number] | { kind: "ad"; ad: AdForMe };
    if (!ads?.length) return feedItems as Item[];
    const out: Item[] = [];
    let next = 0;
    feedItems.forEach((item, i) => {
      out.push(item);
      if ((i + 1) % 8 === 0 && next < ads.length) out.push({ kind: "ad", ad: ads[next++]! });
    });
    return out;
  }, [feedItems, ads]);

  // The For You feed is ranked, so the newest post isn't necessarily first.
  const newestCreatedAt = useMemo(
    () =>
      filteredPosts.reduce<string | null>(
        (newest, post) => (!newest || post.created_at > newest ? post.created_at : newest),
        null,
      ),
    [filteredPosts],
  );

  function refreshFeed() {
    return queryClient.invalidateQueries({ queryKey: ["feed"] });
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        {homeMode === "essentials" ? (
          <div className="mx-auto max-w-2xl space-y-4 px-3 py-4 sm:px-4 sm:py-6">
            <HomeModeSwitch />
            <EssentialsHome />
          </div>
        ) : (
          <PullToRefresh onRefresh={refreshFeed}>
            <div className="mx-auto max-w-2xl py-4 sm:px-4 sm:py-6">
              <div className="space-y-4 px-3 sm:px-0">
                <HomeModeSwitch />
                {engagement && <StoriesRow />}
                <FeedScopeBar
                  scope={scope}
                  onScopeChange={changeScope}
                  hasGarageCars={hasGarageCars}
                  isAuthenticated={!!user}
                  showForYou={engagement}
                />
                <CategoryFilterBar category={category} onCategoryChange={setCategory} />
                {engagement && <FeedHighlights />}

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
                    preferredGarageCarId={filterCarId}
                    onGarageCarSelected={setSessionFilterCarId}
                    audience={scope === "friends" ? "friends" : "public"}
                  />
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

              <NewPostsPill
                newestCreatedAt={newestCreatedAt}
                enabled={scope === "all" || scope === "for_you" || scope === "popular"}
                onShow={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  void refreshFeed();
                }}
              />
              <div className="mt-4 space-y-1 bg-muted/60 sm:space-y-4 sm:bg-transparent">
                {isLoading &&
                  Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} immersive />)}

                {!isLoading && !feedError && filteredPosts.length === 0 && (
                  <div className="mx-3 rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground sm:mx-0">
                    {scope === "my_car"
                      ? "No posts about your car yet — be the first."
                      : scope === "friends" && following?.length === 0
                        ? "You are not following anyone yet — visit a profile and tap Follow."
                        : scope === "friends"
                          ? "No posts from people you follow in this category yet."
                          : "No posts here yet — try a different filter."}
                  </div>
                )}

                {feedWithAds.map((item) =>
                  item.kind === "ad" ? (
                    <AdCard key={`ad-${item.ad.id}`} ad={item.ad} />
                  ) : item.kind === "news" ? (
                    <NewsCard
                      key={`news-${item.news.id}`}
                      news={item.news}
                      liked={newsLikes?.has(item.news.id) ?? false}
                    />
                  ) : (
                    <PostCard
                      key={item.post.id}
                      post={item.post}
                      liked={likedIds?.has(item.post.id) ?? false}
                      onDeleted={refreshFeed}
                      immersive
                    />
                  ),
                )}
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
                {!isLoading && !feedError && filteredPosts.length > 0 && hasNextPage === false && (
                  <div className="bg-background px-4 py-8 text-center sm:rounded-lg sm:border sm:border-border">
                    <span
                      aria-hidden="true"
                      className="mx-auto flex size-11 items-center justify-center rounded-full border border-border bg-muted font-mono text-sm font-semibold text-muted-foreground"
                    >
                      •ᴗ•
                    </span>
                    <p className="mt-3 text-sm font-semibold">You’re all caught up</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      That’s everything in this feed for now.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </PullToRefresh>
        )}
      </main>
    </div>
  );
}
