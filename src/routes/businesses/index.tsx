import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, MapPin, Store } from "lucide-react";
import { Stars, TrustBadge } from "@/components/TrustBadge";
import { BUSINESS_CATEGORY_LABELS, fetchBusinesses, useBusinessesFeature } from "@/lib/businesses";
import { seo } from "@/lib/seo";

type DirSearch = { category?: string | undefined; area?: string | undefined };

export const Route = createFileRoute("/businesses/")({
  validateSearch: (search: Record<string, unknown>): DirSearch => ({
    ...(typeof search["category"] === "string" && search["category"]
      ? { category: search["category"] }
      : {}),
    ...(typeof search["area"] === "string" && search["area"]
      ? { area: search["area"].slice(0, 30) }
      : {}),
  }),
  head: () =>
    seo({
      title: "Trusted local car businesses & reviews — RevMate",
      description:
        "Find mobile mechanics, bodywork, EV charger installers, detailers and dealers near you, rated and reviewed by RevMate members.",
      path: "/businesses",
    }),
  component: BusinessesPage,
});

function BusinessesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const enabled = useBusinessesFeature();
  const [area, setArea] = useState(search.area ?? "");
  const { data: businesses, isLoading } = useQuery({
    queryKey: ["businesses", search],
    queryFn: () => fetchBusinesses(search),
    enabled,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Store className="size-6 text-primary" /> Local car businesses
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Mechanics, bodywork, EV installers, detailers and dealers — rated by RevMate members, so you
        can find the good ones and avoid the bad.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void navigate({ search: { ...search, area: area.trim() || undefined } });
        }}
      >
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Town or postcode area, e.g. LS6"
          aria-label="Area"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Search
        </button>
      </form>
      <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => void navigate({ search: { ...search, category: undefined } })}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${!search.category ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          All
        </button>
        {Object.entries(BUSINESS_CATEGORY_LABELS).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => void navigate({ search: { ...search, category: id } })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${search.category === id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && enabled && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      <ul className="mt-4 space-y-2">
        {businesses?.map((b) => (
          <li key={b.id}>
            <Link
              to="/businesses/$businessId"
              params={{ businessId: b.id }}
              className="flex gap-3 rounded-xl border border-border bg-card p-3 hover:bg-accent/50"
            >
              <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {b.logo_url ? (
                  <img src={b.logo_url} alt="" className="size-full object-cover" />
                ) : (
                  <Store className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 font-semibold">
                  {b.name}
                  {b.verified && (
                    <BadgeCheck className="size-4 text-primary" aria-label="Verified by RevMate" />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {BUSINESS_CATEGORY_LABELS[b.category] ?? b.category}
                  {b.town && (
                    <>
                      {" · "}
                      <MapPin className="inline size-3" /> {b.town}
                    </>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {b.reviews_count > 0 ? (
                    <span className="flex items-center gap-1">
                      <Stars rating={Number(b.rating_avg)} /> {Number(b.rating_avg).toFixed(1)} (
                      {b.reviews_count})
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No reviews yet</span>
                  )}
                  <TrustBadge business={b} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {enabled && !isLoading && businesses?.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No businesses listed here yet. RevMate is adding trusted local businesses — check back
          soon.
        </div>
      )}
    </main>
  );
}
