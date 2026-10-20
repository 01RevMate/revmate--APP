import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BadgeCheck, Images, MapPin, Store } from "lucide-react";
import { Stars, TrustBadge } from "@/components/TrustBadge";
import {
  BUSINESS_CATEGORY_LABELS,
  BUSINESS_SECTORS,
  fetchBusinesses,
  fetchPhotoSummaries,
  isPromotedBusiness,
  openStatus,
  sectorOf,
  useBusinessesFeature,
  useBusinessProfilesFeature,
  type BusinessProfile,
} from "@/lib/businesses";
import { MIN_PHOTOS } from "@/components/BusinessManager";
import { seo } from "@/lib/seo";
import { Button } from "@/components/ui/button";

type DirSearch = {
  sector?: string | undefined;
  category?: string | undefined;
  area?: string | undefined;
};

export const Route = createFileRoute("/businesses/")({
  validateSearch: (search: Record<string, unknown>): DirSearch => ({
    ...(typeof search["sector"] === "string" && search["sector"]
      ? { sector: search["sector"] }
      : {}),
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
        "Find car dealers, garages, mobile mechanics, bodyshops, tyre fitters, detailers, EV specialists and more near you, with photos and reviews from RevMate members.",
      path: "/businesses",
    }),
  component: BusinessesPage,
});

function BusinessesPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const enabled = useBusinessesFeature();
  const [area, setArea] = useState(search.area ?? "");
  const profilesOn = useBusinessProfilesFeature();
  const { data: businesses, isLoading } = useQuery({
    queryKey: ["businesses", search],
    queryFn: () => fetchBusinesses(search),
    enabled,
  });
  const ids = (businesses ?? []).map((b) => b.id);
  const { data: photoMap } = useQuery({
    queryKey: ["businesses", "photos", ids],
    queryFn: () => fetchPhotoSummaries(ids),
    enabled: profilesOn && ids.length > 0,
  });
  // Promoted first (already sorted), then profiles with enough photos.
  const ranked = [...(businesses ?? [])].sort(
    (a, b) =>
      Number(isPromotedBusiness(b)) - Number(isPromotedBusiness(a)) ||
      Number((photoMap?.get(b.id)?.count ?? 0) >= MIN_PHOTOS) -
        Number((photoMap?.get(a.id)?.count ?? 0) >= MIN_PHOTOS),
  );
  const sector =
    BUSINESS_SECTORS.find((s) => s.id === search.sector) ??
    (search.category ? sectorOf(search.category) : null);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Store className="size-6 text-primary" /> Car businesses near you
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dealers, garages, bodyshops, tyres, detailing, EV specialists and more, with photos and
        reviews from RevMate members, so you can find the good ones and avoid the bad.
      </p>

      <Button asChild variant="outline" className="mt-3"><Link to="/businesses/manage"><Store className="size-4" /> Add or manage your business</Link></Button>

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
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() =>
            void navigate({ search: { ...search, sector: undefined, category: undefined } })
          }
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${!sector ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          All
        </button>
        {BUSINESS_SECTORS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() =>
              void navigate({ search: { ...search, sector: s.id, category: undefined } })
            }
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${sector?.id === s.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>
      {sector && (
        <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <button
            type="button"
            onClick={() =>
              void navigate({ search: { ...search, sector: sector.id, category: undefined } })
            }
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${!search.category ? "border-foreground bg-foreground text-background" : "border-input"}`}
          >
            All {sector.label.toLowerCase()}
          </button>
          {sector.categories.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() =>
                void navigate({ search: { ...search, sector: sector.id, category: id } })
              }
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${search.category === id ? "border-foreground bg-foreground text-background" : "border-input"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isLoading && enabled && <p className="mt-6 text-sm text-muted-foreground">Loading…</p>}
      <ul className="mt-4 space-y-2">
        {ranked.map((b) => {
          const pics = photoMap?.get(b.id);
          const status = openStatus((b as BusinessProfile).opening_hours);
          return (
            <li key={b.id}>
              <Link
                to="/businesses/$businessId"
                params={{ businessId: b.id }}
                className="flex gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-accent/50"
              >
                <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {pics?.urls[0] ? (
                    <img
                      src={pics.urls[0]}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : b.logo_url ? (
                    <img src={b.logo_url} alt="" className="size-full object-cover" />
                  ) : (
                    <Store className="size-6 text-muted-foreground" />
                  )}
                  {pics && pics.count > 1 && (
                    <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      <Images className="size-3" /> {pics.count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 font-semibold">
                    {b.name}
                    {b.verified && (
                      <BadgeCheck
                        className="size-4 text-primary"
                        aria-label="Verified by RevMate"
                      />
                    )}
                    {isPromotedBusiness(b) && (
                      <span className="ml-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                        Pro · Promoted
                      </span>
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
                  {status && (
                    <p className="mt-1 text-xs">
                      <span
                        className={
                          status.open
                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                            : "font-semibold text-red-600 dark:text-red-400"
                        }
                      >
                        {status.open ? "Open" : "Closed"}
                      </span>
                      <span className="text-muted-foreground"> · {status.text}</span>
                    </p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {enabled && !isLoading && ranked.length === 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No businesses listed here yet. RevMate is adding trusted local businesses — check back
          soon.
        </div>
      )}
    </main>
  );
}
