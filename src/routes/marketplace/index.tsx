import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BadgePoundSterling, Heart, History, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useAuth } from "@/hooks/useAuth";
import { MarketListingCard } from "@/components/MarketListingCard";
import {
  fetchMarketListings,
  fetchMyWatchlistIds,
  fetchPartners,
  formatPrice,
  hasRecentPriceDrop,
  isFeatured,
  isNewToday,
  markMarketVisited,
  readLastMarketVisit,
  readRecentlyViewed,
  recordPartnerClick,
  unwatchListing,
  useMarketplaceFeatures,
  watchListing,
  type MarketListing,
  type Partner,
} from "@/lib/marketplace";

type ListingFilter = "car" | "part";
type Sort = "newest" | "price_low" | "price_high" | "watched";

const PRICE_BANDS: { id: string; label: string; min: number; max: number }[] = [
  { id: "any", label: "Any price", min: 0, max: Infinity },
  { id: "u1k", label: "Under £1k", min: 0, max: 1000 },
  { id: "1-5k", label: "£1k–£5k", min: 1000, max: 5000 },
  { id: "5-15k", label: "£5k–£15k", min: 5000, max: 15000 },
  { id: "15k+", label: "£15k+", min: 15000, max: Infinity },
];

// A sponsored tile after every this-many listings (only if partners exist).
const PARTNER_EVERY = 8;

export const Route = createFileRoute("/marketplace/")({
  // ?type=part lets other pages (like Essentials) link straight to parts.
  validateSearch: (search: Record<string, unknown>): { type?: ListingFilter } =>
    search["type"] === "car" || search["type"] === "part" ? { type: search["type"] } : {},
  head: () => ({
    meta: [
      { title: "Buy & Sell — RevMate" },
      { name: "description", content: "Cars and parts for sale from the RevMate community." },
      { property: "og:title", content: "Buy & Sell — RevMate" },
      {
        property: "og:description",
        content: "Cars and parts for sale from the RevMate community.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const { type } = Route.useSearch();
  const market = useMarketplaceFeatures();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [band, setBand] = useState("any");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  // Captured once per visit, then updated, so "new since you were last here"
  // stays put while you browse.
  const [lastVisit, setLastVisit] = useState<number | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    setLastVisit(readLastMarketVisit());
    setRecentIds(readRecentlyViewed());
    markMarketVisited();
  }, []);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", "market"],
    queryFn: fetchMarketListings,
    refetchInterval: 120_000,
  });
  const watchKey = ["watchlist-ids", user?.id];
  const { data: watchIds } = useQuery({
    queryKey: watchKey,
    queryFn: () => fetchMyWatchlistIds(user!.id),
    enabled: market && !!user,
  });
  const { data: partners } = useQuery({
    queryKey: ["marketplace-partners"],
    queryFn: () => fetchPartners(),
    enabled: market,
    staleTime: 10 * 60_000,
  });
  const gridPartners = (partners ?? []).filter((p) => p.placement === "grid");
  const bannerPartner = (partners ?? []).find((p) => p.placement === "banner");

  const visible = useMemo(() => {
    const priceBand = PRICE_BANDS.find((b) => b.id === band) ?? PRICE_BANDS[0]!;
    const term = query.trim().toLowerCase();
    const list = (listings ?? []).filter((listing) => {
      if (type && listing.type !== type) return false;
      if (watchlistOnly && !watchIds?.has(listing.id)) return false;
      if (band !== "any") {
        if (listing.price == null) return false;
        const price = Number(listing.price);
        if (price < priceBand.min || price >= priceBand.max) return false;
      }
      if (term) {
        const haystack = [
          listing.title,
          listing.description,
          listing.headline,
          listing.garage_cars?.make,
          listing.garage_cars?.model,
          listing.cars?.make,
          listing.cars?.model,
          listing.location_area,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!term.split(/\s+/).every((word) => haystack.includes(word))) return false;
      }
      return true;
    });
    const price = (l: MarketListing) => (l.price == null ? null : Number(l.price));
    return list.sort((a, b) => {
      if (sort === "price_low") return (price(a) ?? Infinity) - (price(b) ?? Infinity);
      if (sort === "price_high") return (price(b) ?? -1) - (price(a) ?? -1);
      if (sort === "watched") return (b.saves_count ?? 0) - (a.saves_count ?? 0);
      // Newest, with paid Featured listings pinned to the top.
      const featured = Number(isFeatured(b)) - Number(isFeatured(a));
      return featured || b.created_at.localeCompare(a.created_at);
    });
  }, [listings, type, watchlistOnly, watchIds, band, query, sort]);

  const newToday = (listings ?? []).filter(isNewToday).length;
  const newSinceVisit = lastVisit
    ? (listings ?? []).filter((l) => new Date(l.created_at).getTime() > lastVisit).length
    : 0;
  const drops = (listings ?? []).filter(hasRecentPriceDrop).length;
  const recent = recentIds
    .map((id) => listings?.find((l) => l.id === id))
    .filter((l): l is MarketListing => !!l);

  async function toggleWatch(listing: MarketListing) {
    if (!user)
      return openAuthModal("Create a free account to watch listings and get price-drop alerts.");
    const watching = watchIds?.has(listing.id) ?? false;
    queryClient.setQueryData<Set<string>>(watchKey, (prev) => {
      const next = new Set(prev);
      if (watching) next.delete(listing.id);
      else next.add(listing.id);
      return next;
    });
    try {
      if (watching) await unwatchListing(listing.id, user.id);
      else {
        await watchListing(listing.id, user.id);
        toast.success("Watching — we'll tell you if the price drops");
      }
      queryClient.invalidateQueries({ queryKey: ["listings", "market"] });
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: watchKey });
      toast.error(err instanceof Error ? err.message : "Couldn't update your watchlist");
    }
  }

  const sellButton = (
    <Link
      to="/sell"
      search={{ garageCarId: undefined }}
      onClick={(e) => {
        if (!user) {
          e.preventDefault();
          openAuthModal("Create a free account to list a car or part.");
        }
      }}
      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow hover:bg-primary/90"
    >
      <BadgePoundSterling className="size-4" /> Sell
    </Link>
  );

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Buy & Sell</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {listings ? `${listings.length} for sale` : "Cars and parts from the community"}
            {newToday > 0 && (
              <span className="ml-1 font-semibold text-emerald-600">· {newToday} new today</span>
            )}
            {drops > 0 && (
              <span className="ml-1 font-semibold text-red-600">· {drops} price drops</span>
            )}
          </p>
        </div>
        {sellButton}
      </header>

      {/* Sticky so the search is always one thumb away while scrolling. */}
      <div className="sticky top-14 z-20 -mx-3 mt-3 space-y-2 border-b border-border bg-background/95 px-3 pb-2.5 pt-2 backdrop-blur sm:-mx-4 sm:px-4 md:top-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search makes, models, parts…"
            className="w-full rounded-full border border-input bg-muted/50 py-2.5 pl-9 pr-3 text-sm focus:bg-background"
          />
        </div>
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
          {(
            [
              [undefined, "All"],
              ["car", "Cars"],
              ["part", "Parts"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={label}
              to="/marketplace"
              search={value ? { type: value } : {}}
              onClick={() => setWatchlistOnly(false)}
              className={chip(type === value && !watchlistOnly)}
            >
              {label}
            </Link>
          ))}
          {market && (
            <button
              type="button"
              onClick={() =>
                user
                  ? setWatchlistOnly((v) => !v)
                  : openAuthModal("Create a free account to use a watchlist.")
              }
              className={chip(watchlistOnly)}
            >
              <Heart className="size-3.5" fill={watchlistOnly ? "currentColor" : "none"} />{" "}
              Watchlist
              {watchIds && watchIds.size > 0 && ` (${watchIds.size})`}
            </button>
          )}
          <span className="mx-0.5 w-px shrink-0 bg-border" />
          {PRICE_BANDS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBand(b.id)}
              className={chip(band === b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {visible.length} {visible.length === 1 ? "result" : "results"}
            {newSinceVisit > 0 && sort === "newest" && (
              <span className="ml-1 font-semibold text-emerald-600">
                · {newSinceVisit} new since your last visit
              </span>
            )}
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            aria-label="Sort listings"
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="newest">Newest first</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
            {market && <option value="watched">Most watched</option>}
          </select>
        </div>
      </div>

      {bannerPartner && <PartnerBanner partner={bannerPartner} />}

      {recent.length > 0 && !watchlistOnly && !query && (
        <section className="mt-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <History className="size-4" /> Pick up where you left off
          </h2>
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0">
            {recent.map((listing) => (
              <Link
                key={listing.id}
                to="/marketplace/$listingId"
                params={{ listingId: listing.id }}
                className="w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="aspect-[4/3] bg-muted">
                  {listing.photos?.[0] && (
                    <img
                      src={listing.photos[0]}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <p className="px-2 pt-1 text-sm font-extrabold">{formatPrice(listing.price)}</p>
                <p className="truncate px-2 pb-1.5 text-[11px] text-muted-foreground">
                  {listing.title}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {watchlistOnly
            ? "Nothing on your watchlist yet — tap the heart on a listing to watch it and get price-drop alerts."
            : query || band !== "any"
              ? "Nothing matches that yet. Try a wider search — new listings land every day."
              : type === "part"
                ? "No parts listed yet — got something in the shed? List it."
                : "No listings yet — be the first to list a car or part."}
        </div>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        {visible.map((listing, index) => (
          <GridItems
            key={listing.id}
            index={index}
            partner={
              gridPartners.length
                ? gridPartners[Math.floor(index / PARTNER_EVERY) % gridPartners.length]
                : undefined
            }
          >
            <MarketListingCard
              listing={listing}
              isNewSinceVisit={!!lastVisit && new Date(listing.created_at).getTime() > lastVisit}
              watched={watchIds?.has(listing.id) ?? false}
              canWatch={market}
              onToggleWatch={() => void toggleWatch(listing)}
              isMine={user?.id === listing.user_id}
            />
          </GridItems>
        ))}
        {visible.length > 0 && (
          <li>
            <Link
              to="/sell"
              search={{ garageCarId: undefined }}
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  openAuthModal("Create a free account to list a car or part.");
                }
              }}
              className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center hover:bg-primary/10"
            >
              <Sparkles className="size-6 text-primary" />
              <p className="text-sm font-bold">Got something to sell?</p>
              <p className="text-xs text-muted-foreground">List it free in a couple of minutes</p>
              <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary">
                Start listing <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}

function chip(active: boolean) {
  return `flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-transparent bg-foreground text-background" : "border-border bg-background hover:bg-accent"}`;
}

/** A listing, plus a sponsored tile after every PARTNER_EVERY listings. */
function GridItems({
  index,
  partner,
  children,
}: {
  index: number;
  partner: Partner | undefined;
  children: React.ReactNode;
}) {
  const showPartner = partner && (index + 1) % PARTNER_EVERY === 0;
  return (
    <>
      <li>{children}</li>
      {showPartner && (
        <li>
          <PartnerTile partner={partner} />
        </li>
      )}
    </>
  );
}

function PartnerTile({ partner }: { partner: Partner }) {
  return (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener sponsored"
      onClick={() => recordPartnerClick(partner.id)}
      className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {partner.image_url ? (
          <img
            src={partner.image_url}
            alt={partner.name}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 p-3 text-center text-lg font-extrabold text-white">
            {partner.name}
          </div>
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Sponsored
        </span>
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="text-sm font-bold">{partner.name}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{partner.tagline}</p>
        <span className="mt-auto pt-2 text-xs font-bold text-primary">{partner.cta} →</span>
      </div>
    </a>
  );
}

function PartnerBanner({ partner }: { partner: Partner }) {
  return (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener sponsored"
      onClick={() => recordPartnerClick(partner.id)}
      className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-3 shadow-sm hover:shadow-md"
    >
      {partner.image_url && (
        <img src={partner.image_url} alt="" className="size-12 shrink-0 rounded-lg object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sponsored
        </p>
        <p className="truncate text-sm font-bold">{partner.name}</p>
        <p className="truncate text-xs text-muted-foreground">{partner.tagline}</p>
      </div>
      <span className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
        {partner.cta}
      </span>
    </a>
  );
}
