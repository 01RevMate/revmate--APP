import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LogIn, Search, Stethoscope } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";
import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";
import { fetchMyLikedPostIds } from "@/lib/posts";
import { fetchGarage } from "@/lib/garage";
import { fetchIssuePosts, ISSUE_SYSTEMS, useDiagnosticsFeature } from "@/lib/diagnostics";
import { seo } from "@/lib/seo";

type IssueSearch = {
  make?: string | undefined;
  model?: string | undefined;
  system?: string | undefined;
  fixed?: boolean | undefined;
};

export const Route = createFileRoute("/issues")({
  validateSearch: (search: Record<string, unknown>): IssueSearch => ({
    ...(typeof search["make"] === "string" && search["make"] ? { make: search["make"] } : {}),
    ...(typeof search["model"] === "string" && search["model"] ? { model: search["model"] } : {}),
    ...(typeof search["system"] === "string" && search["system"]
      ? { system: search["system"] }
      : {}),
    ...(search["fixed"] === true || search["fixed"] === "true" ? { fixed: true } : {}),
  }),
  head: () =>
    seo({
      title: "Car problems & fixes — RevMate",
      description:
        "Find common faults for your car and how other owners fixed them: engine, gearbox, electrics, bodywork and more.",
      path: "/issues",
    }),
  component: IssuesPage,
});

/** Find problems other owners have had with a car, and how they fixed them. */
function IssuesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/issues" });
  const { user } = useAuth();
  const enabled = useDiagnosticsFeature();
  const [make, setMake] = useState(search.make ?? "");
  const [model, setModel] = useState(search.model ?? "");
  const setSearch = (next: IssueSearch) => void navigate({ search: next, replace: true });
  const { data: garage } = useQuery({
    queryKey: ["garage", user?.id],
    enabled: !!user,
    queryFn: () => fetchGarage(user!.id),
  });
  const myCars = (garage ?? []).filter(
    (c) => c.ownership_status !== "previous" && c.make && c.model,
  );

  const { data: posts, isLoading } = useQuery({
    queryKey: ["issues", search],
    queryFn: () =>
      fetchIssuePosts({
        ...(search.make ? { make: search.make } : {}),
        ...(search.model ? { model: search.model } : {}),
        ...(search.system ? { system: search.system } : {}),
        resolvedOnly: !!search.fixed,
      }),
    enabled,
  });
  const { data: likedIds } = useQuery({
    queryKey: ["issues", "liked", user?.id, posts?.map((p) => p.id)],
    queryFn: () =>
      fetchMyLikedPostIds(
        user!.id,
        posts!.map((p) => p.id),
      ),
    enabled: !!user && !!posts?.length,
  });

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-accent"}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Stethoscope className="size-6 text-primary" /> Problems &amp; fixes
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Find faults other owners have had and how they fixed them.
      </p>

      {!user && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
          <p className="text-sm text-muted-foreground">
            Sign in to pick a car from your garage — or find any car below.
          </p>
          <Link
            to="/login"
            search={{ redirect: "/issues" }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            <LogIn className="size-4" /> Sign in
          </Link>
        </div>
      )}

      {myCars.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Use a car you own
          </p>
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
            {myCars.map((car) => {
              const active = search.make === car.make && search.model === car.model;
              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => {
                    setMake(car.make);
                    setModel(car.model);
                    setSearch({ ...search, make: car.make, model: car.model });
                  }}
                  className={chip(active)}
                >
                  🚗 {car.nickname || `${car.make} ${car.model}`}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Or find any car
          </p>
        </div>
      )}

      <form
        className="mt-4 grid grid-cols-2 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch({ ...search, make: make || undefined, model: model || undefined });
        }}
      >
        <MakeSelect
          value={make}
          onChange={(value) => {
            setMake(value);
            setModel("");
          }}
        />
        {make ? <ModelSelect make={make} value={model} onChange={setModel} /> : <div />}
        <button className="col-span-2 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Search className="size-4" /> Find problems
        </button>
      </form>

      <div className="-mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setSearch({ ...search, fixed: search.fixed ? undefined : true })}
          className={chip(!!search.fixed)}
        >
          ✅ Fixed only
        </button>
        <button
          type="button"
          onClick={() => setSearch({ ...search, system: undefined })}
          className={chip(!search.system)}
        >
          All parts
        </button>
        {ISSUE_SYSTEMS.map((system) => (
          <button
            key={system.id}
            type="button"
            onClick={() => setSearch({ ...search, system: system.id })}
            className={chip(search.system === system.id)}
          >
            {system.emoji} {system.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {isLoading &&
          enabled &&
          Array.from({ length: 2 }).map((_, i) => <PostCardSkeleton key={i} />)}
        {posts?.map((post) => (
          <PostCard key={post.id} post={post} liked={likedIds?.has(post.id) ?? false} />
        ))}
        {enabled && !isLoading && posts?.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nothing reported yet for this. If you have the problem, post it in Diagnostics so owners
            who've fixed it can help.
          </div>
        )}
      </div>
    </main>
  );
}
