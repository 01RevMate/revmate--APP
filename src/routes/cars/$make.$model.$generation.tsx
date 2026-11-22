import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart, ThumbsDown, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { carLabel, engineOptions, fetchCarBySlug, fetchCarFaults, yearRange } from "@/lib/cars";
import { loadForSsr } from "@/lib/ssrLoad";
import { carPageHead, faultCostText } from "@/lib/seoHeads";

const FAULT_SOURCE_LABELS = {
  ai: "AI-sourced",
  owner: "Owner-reported",
  editorial: "RevMate editorial",
} as const;
import { fetchMyLikedPostIds, fetchPostsByCar } from "@/lib/posts";
import { fetchListingsForCar } from "@/lib/listings";
import { PostCard } from "@/components/PostCard";
import { DealsStrip } from "@/components/DealsStrip";
import { CarLogo } from "@/components/CarLogo";
import { PageSkeleton } from "@/components/PageSkeletons";
import { useMinSkeleton } from "@/hooks/useMinSkeleton";

export const Route = createFileRoute("/cars/$make/$model/$generation")({
  // The car, its faults, tagged posts and listings load here so the first HTML (the one Google
  // reads) already contains them. If the database is slow, the page fetches in the browser instead.
  loader: async ({ params }) => {
    const result = await loadForSsr(async () => {
      const car = await fetchCarBySlug(params.make, params.model, params.generation);
      if (!car) return { car: null, faults: [], posts: [], listings: [] };
      const [faults, posts, listings] = await Promise.all([
        fetchCarFaults(car.id),
        fetchPostsByCar(car.id),
        fetchListingsForCar(car.id),
      ]);
      return { car, faults, posts, listings };
    });
    // A car that doesn't exist should be a real 404, not a 200 page that says "not found".
    if (result.ok && !result.data.car) throw notFound();
    return result;
  },
  head: ({ params, loaderData }) => carPageHead(params, loaderData),
  component: CarPage,
});

function CarPage() {
  const { make, model, generation } = Route.useParams();
  const { user } = useAuth();
  const loaded = Route.useLoaderData();
  // Data fetched by the loader seeds the queries, so the browser doesn't fetch it again straight away.
  const seed = loaded.ok ? loaded.data : null;

  const carQuery = useQuery({
    queryKey: ["car", make, model, generation],
    queryFn: () => fetchCarBySlug(make, model, generation),
    ...(seed ? { initialData: seed.car } : {}),
    staleTime: 60_000,
  });
  const car = carQuery.data;

  const posts = useQuery({
    queryKey: ["posts-by-car", car?.id],
    enabled: !!car,
    queryFn: () => fetchPostsByCar(car!.id),
    ...(seed ? { initialData: seed.posts } : {}),
    staleTime: 60_000,
  });

  const { data: likedIds } = useQuery({
    queryKey: ["posts-by-car", "liked", car?.id, user?.id],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts.data!.map((p) => p.id),
      ),
    enabled: !!user && !!posts.data && posts.data.length > 0,
  });

  const faults = useQuery({
    queryKey: ["faults", car?.id],
    enabled: !!car,
    queryFn: () => fetchCarFaults(car!.id),
    ...(seed ? { initialData: seed.faults } : {}),
    staleTime: 60_000,
  });

  const listings = useQuery({
    queryKey: ["listings", car?.id],
    enabled: !!car,
    queryFn: () => fetchListingsForCar(car!.id),
    ...(seed ? { initialData: seed.listings } : {}),
    staleTime: 60_000,
  });

  const showSkeleton = useMinSkeleton(carQuery.isLoading);
  if (showSkeleton) {
    return <PageSkeleton wide />;
  }

  if (!car) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-xl font-semibold">Car page not found</h1>
        <Link to="/cars" className="mt-2 inline-block text-sm text-muted-foreground underline">
          Browse all cars
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <CarLogo make={car.make} className="size-10" />
        <h1 className="text-2xl font-semibold tracking-tight">{carLabel(car)}</h1>
        {car.status === "unverified" && (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            Unverified
          </span>
        )}
      </div>
      {car.summary && <p className="mt-2 max-w-2xl text-muted-foreground">{car.summary}</p>}
      {car.source_url && (
        <a
          href={car.source_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-1 inline-block text-xs text-muted-foreground underline"
        >
          Source
        </a>
      )}

      <Section title="Specs">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Years" value={yearRange(car)} />
          <Row label="Body type" value={car.body_type ?? "—"} />
        </dl>
        <h3 className="mt-4 text-sm font-medium">Engine options</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {engineOptions(car).map((engine, i) => (
            <li key={i}>
              {engine.name} · {engine.power_bhp ?? "?"} bhp · {engine.fuel} · {engine.gearbox}
            </li>
          ))}
          {engineOptions(car).length === 0 && <li>No engine data yet.</li>}
        </ul>
      </Section>

      <Section title="Common faults">
        <ul className="space-y-3">
          {faults.data?.map((fault) => (
            <li key={fault.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{fault.title}</p>
                <span className="text-xs text-muted-foreground">
                  {/* A cost range is only shown when a source backs it; the source is linked. */}
                  {faultCostText(fault) ?? "Cost unknown"}
                  {faultCostText(fault) && fault.cost_source_url && (
                    <>
                      {" "}
                      (
                      <a
                        href={fault.cost_source_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline"
                      >
                        cost source
                      </a>
                      )
                    </>
                  )}{" "}
                  · {FAULT_SOURCE_LABELS[fault.source] ?? "Owner-reported"}
                  {fault.source_url && (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={fault.source_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline"
                      >
                        Source
                      </a>
                    </>
                  )}
                </span>
              </div>
              {fault.description && (
                <p className="mt-1 text-sm text-muted-foreground">{fault.description}</p>
              )}
            </li>
          ))}
          {faults.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No faults logged yet.</li>
          )}
        </ul>
      </Section>

      {/* Labelled "Ad" and hidden for Plus members; Jordan to design. */}
      <div className="mt-8">
        <DealsStrip placement="faults" title="Get a fixed-price quote" />
      </div>

      <Section title="Community posts">
        <div className="space-y-4">
          {posts.data?.map((post) => (
            <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
          ))}
          {posts.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No posts tagged with this car yet — tag it next time you post to the feed.
            </p>
          )}
        </div>
        <Link to="/ask" className="mt-3 inline-block text-sm font-medium text-primary underline">
          Ask for help with this car
        </Link>
      </Section>

      <Section title="Listings">
        <Link to="/sell" search={{ garageCarId: undefined }} className="text-sm underline">
          List a car or part
        </Link>
        <ul className="mt-4 space-y-3">
          {listings.data?.map((listing) => (
            <li key={listing.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{listing.title}</p>
                <span className="text-sm text-muted-foreground">
                  {listing.price != null ? `£${listing.price}` : "POA"} · {listing.type}
                </span>
              </div>
              {listing.description && (
                <p className="mt-1 text-sm text-muted-foreground">{listing.description}</p>
              )}
              {listing.show_car_stats && listing.garage_cars && (
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Heart className="size-3.5" />
                    {listing.garage_cars.likes_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <ThumbsDown className="size-3.5" />
                    {listing.garage_cars.dislikes_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {listing.garage_cars.followers_count}
                  </span>
                </div>
              )}
            </li>
          ))}
          {listings.data?.length === 0 && (
            <li className="text-sm text-muted-foreground">No listings for this car yet.</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}
