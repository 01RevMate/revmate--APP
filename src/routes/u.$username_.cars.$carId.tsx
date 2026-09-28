import { useState } from "react";
import { CarCarePanel } from "@/components/CarCarePanel";
import { CommonIssuesPanel } from "@/components/CommonIssuesPanel";
import { useCarCareFeature } from "@/lib/carCare";
import { useDiagnosticsFeature } from "@/lib/diagnostics";
import { fetchGarageCarSeo } from "@/lib/seoData";
import { garageCarHead } from "@/lib/seoHeads";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchGarageCar } from "@/lib/garage";
import { fetchMyLikedPostIds, fetchPostsByGarageCar } from "@/lib/posts";
import { GarageCarCard } from "@/components/GarageCarCard";
import { PostCard } from "@/components/PostCard";
import { BuildTimeline } from "@/components/BuildTimeline";
import { displayUsernameWithoutAt } from "@/lib/usernames";

export const Route = createFileRoute("/u/$username_/cars/$carId")({
  loader: ({ params }) => fetchGarageCarSeo(params.carId),
  head: ({ params, loaderData }) =>
    garageCarHead(params.username, params.carId, loaderData ?? null),
  component: CarProfilePage,
});

function CarProfilePage() {
  const { username, carId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"posts" | "timeline">("posts");

  const { data: car, isLoading } = useQuery({
    queryKey: ["garage-car", carId],
    queryFn: () => fetchGarageCar(carId),
  });

  const { data: posts } = useQuery({
    queryKey: ["posts-by-garage-car", carId],
    queryFn: () => fetchPostsByGarageCar(carId),
  });

  const { data: likedIds } = useQuery({
    queryKey: ["posts-by-garage-car", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts!.map((p) => p.id),
      ),
    enabled: !!user && !!posts && posts.length > 0,
  });

  const careOn = useCarCareFeature();
  const diagnosticsOn = useDiagnosticsFeature();

  if (isLoading) {
    return <p className="mx-auto max-w-2xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!car) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This car doesn't exist.</p>
      </div>
    );
  }

  const isOwner = user?.id === car.user_id;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        to="/u/$username"
        params={{ username }}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to {displayUsernameWithoutAt(username)}'s garage
      </Link>

      <div className="mt-4">
        <GarageCarCard
          car={car}
          isOwner={isOwner}
          onRemoved={() => navigate({ to: "/u/$username", params: { username } })}
        />
      </div>

      {isOwner && careOn && car.ownership_status === "current" && (
        <div className="mt-4">
          <CarCarePanel key={car.id} car={car} />
        </div>
      )}

      {diagnosticsOn && (
        <div className="mt-4">
          <CommonIssuesPanel make={car.make} model={car.model} />
        </div>
      )}

      <section className="mt-8 border-t border-border pt-6">
        <div className="mb-4 inline-flex rounded-full border border-border p-0.5 text-sm">
          {(["posts", "timeline"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className={`rounded-full px-4 py-1 font-medium transition-colors ${view === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {value === "posts" ? `Posts as ${car.nickname}` : "Build timeline"}
            </button>
          ))}
        </div>
        {view === "timeline" ? (
          <BuildTimeline car={car} posts={posts ?? []} />
        ) : (
          <div className="space-y-4">
            {posts?.map((post) => (
              <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
            ))}
            {posts?.length === 0 && (
              <p className="text-sm text-muted-foreground">No posts made as {car.nickname} yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
