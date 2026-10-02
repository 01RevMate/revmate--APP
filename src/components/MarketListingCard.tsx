import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { Camera, Eye, Heart, MapPin, Star, TrendingDown } from "lucide-react";
import {
  formatPrice,
  hasRecentPriceDrop,
  isFeatured,
  isNewToday,
  type MarketListing,
} from "@/lib/marketplace";
import { isAutomatic } from "@/lib/vehicleSpecs";
import { PART_CATEGORY_LABELS, type MyCar, type PriceGuide } from "@/lib/marketDeals";
import { PriceGuideBadge } from "@/components/PriceGuideBadge";
import { roughMiles } from "@/lib/myArea";

/**
 * A marketplace tile built to be scanned fast: photo first, price as the
 * loudest thing on the card, then the handful of facts buyers filter on in
 * their heads (year, make/model, miles, area). Badges only ever reflect real
 * data — new, price dropped, featured — never invented urgency.
 */
export function MarketListingCard({
  listing,
  isNewSinceVisit,
  watched,
  canWatch,
  onToggleWatch,
  isMine,
  miles = null,
  fits = null,
  guide = null,
}: {
  listing: MarketListing;
  isNewSinceVisit: boolean;
  watched: boolean;
  canWatch: boolean;
  onToggleWatch: () => void;
  isMine: boolean;
  /** Distance from the buyer's postcode, when they've set one. */
  miles?: number | null;
  /** The buyer's garage car this part fits. */
  fits?: MyCar | null;
  guide?: PriceGuide | null;
}) {
  const car = listing.garage_cars;
  const catalog = listing.cars;
  const drop = hasRecentPriceDrop(listing);
  const featured = isFeatured(listing);
  const saving =
    drop && listing.previous_price != null && listing.price != null
      ? Number(listing.previous_price) - Number(listing.price)
      : 0;
  const make = listing.make ?? car?.make ?? catalog?.make;
  const model = listing.model ?? car?.model ?? catalog?.model;
  const facts =
    listing.type === "car"
      ? [
          listing.year ?? car?.year,
          [make, model].filter(Boolean).join(" ") || null,
          listing.mileage != null ? `${listing.mileage.toLocaleString("en-GB")} mi` : null,
          listing.transmission
            ? isAutomatic(listing.transmission)
              ? "Auto"
              : listing.transmission === "manual"
                ? "Manual"
                : null
            : null,
        ]
      : [
          (listing.part_category && PART_CATEGORY_LABELS[listing.part_category]) || "Part",
          make ? `fits ${[make, model].filter(Boolean).join(" ")}` : null,
        ];
  const photoCount = listing.photos?.length ?? 0;

  return (
    <Link
      to="/marketplace/$listingId"
      params={{ listingId: listing.id }}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md ${featured ? "border-amber-400 ring-1 ring-amber-400" : "border-border"}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {listing.photos?.[0] ? (
          <img
            src={listing.photos[0]}
            alt={listing.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
            No photo
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
          {featured && (
            <Badge className="bg-amber-400 text-amber-950">
              <Star className="size-2.5" fill="currentColor" /> Featured
            </Badge>
          )}
          {drop && (
            <Badge className="bg-red-600 text-white">
              <TrendingDown className="size-2.5" /> Price drop
            </Badge>
          )}
          {(isNewSinceVisit || isNewToday(listing)) && (
            <Badge className="bg-emerald-600 text-white">
              {isNewToday(listing) ? "New today" : "New"}
            </Badge>
          )}
          {isMine && <Badge className="bg-primary text-primary-foreground">Your ad</Badge>}
          {fits && !isMine && (
            <Badge className="bg-sky-600 text-white">Fits your {fits.nickname}</Badge>
          )}
        </div>
        {canWatch && !isMine && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleWatch();
            }}
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform active:scale-90"
          >
            <Heart
              className={`size-4 ${watched ? "text-red-500" : ""}`}
              fill={watched ? "currentColor" : "none"}
            />
          </button>
        )}
        {photoCount > 1 && (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            <Camera className="size-3" /> {photoCount}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-lg font-extrabold leading-tight tracking-tight sm:text-xl">
            {formatPrice(listing.price)}
          </span>
          {drop && (
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(listing.previous_price)}
            </span>
          )}
        </div>
        {saving > 0 && (
          <p className="text-[11px] font-bold text-red-600">Save {formatPrice(saving)}</p>
        )}
        {guide && guide.tone !== "high" && <PriceGuideBadge guide={guide} compact />}
        <p className="mt-0.5 line-clamp-1 text-sm font-medium">{listing.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {facts.filter(Boolean).join(" · ")}
        </p>
        <div className="mt-auto flex items-center gap-2 pt-1.5 text-[11px] text-muted-foreground">
          {(listing.location_area || miles != null) && (
            <span className="flex min-w-0 items-center gap-0.5 truncate">
              <MapPin className="size-3 shrink-0" />
              {miles != null
                ? `${miles < 1 ? "<1 mi" : roughMiles(miles)}${listing.location_area ? ` · ${listing.location_area}` : ""}`
                : listing.location_area}
            </span>
          )}
          <span className="shrink-0">
            {formatDistanceToNowStrict(new Date(listing.created_at), { addSuffix: true })}
          </span>
          {listing.saves_count > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5">
              <Heart className="size-3" /> {listing.saves_count}
            </span>
          )}
          {listing.saves_count === 0 && listing.views_count > 0 && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5">
              <Eye className="size-3" /> {listing.views_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow ${className}`}
    >
      {children}
    </span>
  );
}
