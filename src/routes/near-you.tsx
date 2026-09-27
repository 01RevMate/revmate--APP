import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarDays, Loader2, LocateFixed, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PostCard } from "@/components/PostCard";
import {
  distanceKm,
  fetchNearbyMeets,
  fetchNearbyPosts,
  getApproximateLocation,
} from "@/lib/engagement";
import { useEngagementFeaturesStatus } from "@/lib/features";
import { fetchMyLikedPostIds } from "@/lib/posts";

export const Route = createFileRoute("/near-you")({
  head: () => ({
    meta: [
      { title: "Near You — RevMate" },
      { name: "description", content: "Car meets and posts from people near you." },
      { property: "og:title", content: "Near You — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NearYouPage,
});

const RADII = [10, 25, 50, 100];
const STORAGE_KEY = "revmate:nearYouRadius";

function NearYouPage() {
  const { user } = useAuth();
  const status = useEngagementFeaturesStatus();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [radius, setRadius] = useState(() => {
    try {
      return Number(localStorage.getItem(STORAGE_KEY)) || 25;
    } catch {
      return 25;
    }
  });

  const { data: meets, isLoading: meetsLoading } = useQuery({
    queryKey: ["near-you", "meets", location, radius],
    queryFn: () => fetchNearbyMeets(location!.lat, location!.lng, radius),
    enabled: !!location,
  });
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["near-you", "posts", location, radius],
    queryFn: () => fetchNearbyPosts(location!.lat, location!.lng, radius),
    enabled: !!location,
  });
  const { data: likedIds } = useQuery({
    queryKey: ["near-you", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts!.map((p) => p.id),
      ),
    enabled: !!user && !!posts && posts.length > 0,
  });

  async function locate() {
    setLocating(true);
    try {
      setLocation(await getApproximateLocation());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't get your location");
    } finally {
      setLocating(false);
    }
  }

  function changeRadius(value: number) {
    setRadius(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
  }

  if (status !== "on") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-center">
        <MapPin className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {status === "checking" ? "Loading…" : "Near you is coming soon"}
        </h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <MapPin className="size-6 text-emerald-600" /> Near you
      </h1>
      <p className="text-sm text-muted-foreground">Meets and posts from your area.</p>

      {!location ? (
        <div className="mt-6 rounded-lg border border-border p-6 text-center">
          <p className="text-sm">
            We use your rough location (to about 1km) to find what's nearby. It isn't saved.
          </p>
          <button
            type="button"
            onClick={() => void locate()}
            disabled={locating}
            className="mx-auto mt-4 flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LocateFixed className="size-4" />
            )}
            Find what's near me
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Within</span>
            {RADII.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeRadius(value)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${radius === value ? "border-transparent bg-foreground text-background" : "border-border hover:bg-accent"}`}
              >
                {value} km
              </button>
            ))}
          </div>

          <section className="mt-6">
            <h2 className="mb-2 text-lg font-semibold">Meets nearby</h2>
            {meetsLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
            <div className="space-y-2">
              {meets?.map((meet) => (
                <Link
                  key={meet.id}
                  to="/meets/$meetId"
                  params={{ meetId: meet.id }}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/40"
                >
                  <div className="w-12 shrink-0 rounded-md bg-muted py-1 text-center">
                    <p className="text-[10px] font-semibold uppercase text-primary">
                      {format(new Date(meet.starts_at), "MMM")}
                    </p>
                    <p className="text-lg font-bold leading-none">
                      {format(new Date(meet.starts_at), "d")}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{meet.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {meet.location_name}
                      {meet.latitude != null &&
                        meet.longitude != null &&
                        ` · ${Math.round(distanceKm(location.lat, location.lng, meet.latitude, meet.longitude))} km away`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{meet.going_count} going</span>
                </Link>
              ))}
              {meets?.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4" /> No meets within {radius} km yet.{" "}
                  <Link to="/meets" className="text-primary underline">
                    Post one
                  </Link>
                </p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="mb-2 text-lg font-semibold">Posted nearby</h2>
            {postsLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
            <div className="space-y-4">
              {posts?.map((post) => (
                <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
              ))}
              {posts?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing posted within {radius} km yet. Tap the pin when you post to add your area.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
