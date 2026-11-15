import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { BadgeCheck, Loader2, MapPin, Search, Store } from "lucide-react";
import { Stars, TrustBadge } from "@/components/TrustBadge";
import { Button } from "@/components/ui/button";
import { ListRowsSkeleton } from "@/components/PageSkeletons";
import { BUSINESS_CATEGORY_LABELS, openStatus } from "@/lib/businesses";
import {
  MATCH_LABELS,
  NEEDS,
  searchBusinesses,
  type DiscoveryFilters,
  type DiscoveryResult,
} from "@/lib/businessDiscovery";
import { useMyArea } from "@/lib/myArea";

const PAGE = 24;

/**
 * Find a business, for any member (no business account needed). Words, a "what do you need" shortcut,
 * an area, and quality filters. Free searches are ranked by relevance, closeness and trust; payment
 * never changes the order (at most two paid "Promoted" businesses sit at the top, labelled).
 */
export function BusinessDiscovery({
  filters,
  onChange,
}: {
  filters: DiscoveryFilters;
  onChange: (patch: Partial<DiscoveryFilters>) => void;
}) {
  const [q, setQ] = useState(filters.q ?? "");
  const [area, setArea] = useState(filters.area ?? "");
  // The member's saved area is private, so it's used for this search only and never put in the link.
  const [useSaved, setUseSaved] = useState(false);
  const saved = useMyArea();
  const effective: DiscoveryFilters = {
    ...filters,
    ...(useSaved && saved.district ? { area: saved.district } : {}),
  };

  const results = useInfiniteQuery({
    queryKey: ["business-search", effective],
    queryFn: ({ pageParam }) => searchBusinesses(effective, pageParam, PAGE),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.flat().length : undefined),
    staleTime: 30_000,
  });
  const all = results.data?.pages.flat() ?? [];
  const total = all[0] ? Number(all[0].total_count) : 0;
  // At most two paid "Promoted" businesses go first (clearly labelled); everyone else is in ranked order.
  const promoted = all.filter((b) => b.promoted).slice(0, 2);
  const shown = [...promoted, ...all.filter((b) => !promoted.includes(b))];
  const areaActive = !!effective.area;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <Store className="size-6 text-primary" /> Find a car business
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search garages, tyre fitters, detailers, bodyshops, dealers, parts and more. Searching is
        free, and results are ranked by how well they match, how close they are and what members
        say, not by who pays.
      </p>

      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          setUseSaved(false);
          onChange({ q: q.trim() || undefined, area: area.trim() || undefined });
        }}
      >
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">What are you looking for?</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="What do you need? e.g. MOT, tyres, dent repair"
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <Button type="submit">Search</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-48 flex-1 items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">Town or postcode area</span>
            <input
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Town or postcode area, e.g. Leeds or LS6"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          {saved.available && saved.district && (
            <button
              type="button"
              onClick={() => {
                setUseSaved((v) => !v);
                setArea("");
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${useSaved ? "bg-primary text-primary-foreground" : "border-input"}`}
              title="Uses your saved area for this search only. It is never shown to anyone or put in the link."
            >
              {useSaved ? `Using my area (${saved.district})` : "Use my saved area"}
            </button>
          )}
        </div>
      </form>

      <div
        className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
        aria-label="What do you need?"
      >
        <button
          type="button"
          onClick={() => onChange({ need: undefined })}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${!filters.need ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          Anything
        </button>
        {NEEDS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onChange({ need: filters.need === n.id ? undefined : n.id })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${filters.need === n.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {n.emoji} {n.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <div
          className="inline-flex overflow-hidden rounded-full border border-input"
          role="group"
          aria-label="Where"
        >
          {(
            [
              ["any", "Everywhere"],
              ["local", "Near me"],
              ["national", "Nationwide"],
            ] as const
          ).map(([value, label]) => {
            const current = filters.scope ?? (areaActive ? "local" : "any");
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ scope: value })}
                className={`px-3 py-1.5 text-xs font-semibold ${current === value ? "bg-primary text-primary-foreground" : ""}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <select
          aria-label="Minimum rating"
          value={filters.minRating ?? 0}
          onChange={(e) => onChange({ minRating: Number(e.target.value) || undefined })}
          className="rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold"
        >
          <option value={0}>Any rating</option>
          <option value={3}>3★ and up</option>
          <option value={4}>4★ and up</option>
        </select>
        <Toggle
          on={!!filters.trusted}
          label="Highly rated"
          onClick={() => onChange({ trusted: filters.trusted ? undefined : true })}
        />
        <Toggle
          on={!!filters.openNow}
          label="Open now"
          onClick={() => onChange({ openNow: filters.openNow ? undefined : true })}
        />
        <select
          aria-label="Sort"
          value={filters.sort ?? "best"}
          onChange={(e) => onChange({ sort: e.target.value === "rating" ? "rating" : undefined })}
          className="ml-auto rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold"
        >
          <option value="best">Best match</option>
          <option value="rating">Top rated</option>
        </select>
      </div>
      {filters.openNow && (
        <p className="mt-1 text-xs text-muted-foreground">
          Open now uses regular weekly hours (UK time) and leaves out businesses that haven't set
          hours. Bank holidays aren't applied.
        </p>
      )}

      {results.isLoading && <ListRowsSkeleton />}
      {results.isError && (
        <p role="alert" className="mt-4 text-sm">
          Couldn't search just now.{" "}
          <button className="underline" onClick={() => void results.refetch()}>
            Try again
          </button>
        </p>
      )}
      {!results.isLoading && !results.isError && (
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
          {total > 0
            ? `${total} ${total === 1 ? "business" : "businesses"}`
            : "No businesses match that yet"}
        </p>
      )}
      <ul className="mt-2 space-y-2">
        {shown.map((b) => (
          <ResultCard
            key={b.id}
            b={b}
            labelPromoted={promoted.includes(b)}
            areaActive={areaActive}
          />
        ))}
      </ul>
      {results.hasNextPage && (
        <Button
          variant="outline"
          className="mx-auto mt-4 flex"
          disabled={results.isFetchingNextPage}
          onClick={() => void results.fetchNextPage()}
        >
          {results.isFetchingNextPage && <Loader2 className="animate-spin" />} Show more
        </Button>
      )}
      {!results.isLoading && total === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Try fewer filters, a wider area, or "Nationwide". Know a good one that isn't here? Ask
          them to add their business on RevMate.
        </p>
      )}
    </main>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "bg-primary text-primary-foreground" : "border-input"}`}
    >
      {label}
    </button>
  );
}

function ResultCard({
  b,
  labelPromoted,
  areaActive,
}: {
  b: DiscoveryResult;
  labelPromoted: boolean;
  areaActive: boolean;
}) {
  const status = openStatus(b.opening_hours);
  const tier = areaActive ? MATCH_LABELS[b.match_tier] : b.serves_nationwide ? "Nationwide" : null;
  return (
    <li>
      <Link
        to="/businesses/$businessId"
        params={{ businessId: b.id }}
        className="flex gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-accent/50"
      >
        {b.logo_url ? (
          <img
            src={b.logo_url}
            alt=""
            loading="lazy"
            className="size-16 shrink-0 rounded-xl bg-muted object-contain"
          />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Store className="size-7 text-muted-foreground" aria-hidden />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{b.name}</span>
            {b.verified && (
              <BadgeCheck
                className="size-4 shrink-0 text-primary"
                aria-label="Verified by RevMate"
              />
            )}
            {labelPromoted && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Promoted
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-muted-foreground">
            {BUSINESS_CATEGORY_LABELS[b.category] ?? b.category}
            {b.town ? ` · ${b.town}` : ""}
            {tier ? ` · ${tier}` : ""}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {b.reviews_count > 0 ? (
              <span className="flex items-center gap-1">
                <Stars rating={Number(b.rating_avg)} className="size-3.5" />{" "}
                {Number(b.rating_avg).toFixed(1)} ({b.reviews_count})
              </span>
            ) : (
              <span className="text-muted-foreground">No reviews yet</span>
            )}
            {status && (
              <span
                className={
                  status.open
                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {status.open ? "Open" : "Closed"}
              </span>
            )}
            <TrustBadge business={{ ...b, reports_count: 0 }} />
          </span>
        </span>
      </Link>
    </li>
  );
}
