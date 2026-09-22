import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchGarageCar } from "@/lib/garage";
import { fetchMyLikedPostIds, fetchPostsByGarageCar } from "@/lib/posts";
import { GarageCarCard } from "@/components/GarageCarCard";
import { PostCard } from "@/components/PostCard";
import { displayUsername } from "@/lib/usernames";

export const Route = createFileRoute("/u/$username_/cars/$carId")({
  head: ({ params }) => ({
    meta: [{ title: `${displayUsername(params.username)}'s car — RevMate` }],
  }),
  component: CarProfilePage,
});

function CarProfilePage() {
  const { username, carId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

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
        ← Back to {displayUsername(username)}'s garage
      </Link>

      <div className="mt-4">
        <GarageCarCard
          car={car}
          isOwner={isOwner}
          onRemoved={() => navigate({ to: "/u/$username", params: { username } })}
        />
      </div>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-3 text-lg font-semibold">Posts as {car.nickname}</h2>
        <div className="space-y-4">
          {posts?.map((post) => (
            <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
          ))}
          {posts?.length === 0 && (
            <p className="text-sm text-muted-foreground">No posts made as {car.nickname} yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
