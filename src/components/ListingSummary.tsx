import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gavel, MapPin, ShieldCheck, Star, Timer } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { auctionEnded, timeLeft, type AuctionFields } from "@/lib/auctions";
import { CONDITION_LABELS, fetchSellerStats } from "@/lib/marketDeals";
import { formatPrice } from "@/lib/marketplace";
import { displayUsernameWithoutAt } from "@/lib/usernames";

type SummaryListing = Omit<AuctionFields, "sale_format"> & {
  sale_format?: string;
  id: string;
  user_id: string;
  type: string;
  status: string;
  price: number | string | null;
  previous_price?: number | string | null;
  mileage?: number | null;
  item_condition?: string | null;
  location_area?: string | null;
  location_district?: string | null;
  collection_available?: boolean;
  postage_available?: boolean;
  postage_price?: number | string | null;
  open_to_offers?: boolean;
  profiles: { username: string; avatar_url: string | null } | null;
};

/**
 * The top of a listing in RevMate's own style: a price card (or live auction
 * card with bids and time left), the seller card with their RevMate rating,
 * collection and condition, then the main buttons.
 */
export function ListingSummary({
  listing,
  title,
  headline,
  isOwner,
  priceDropText,
  onMessage,
  onBid,
  onOffer,
}: {
  listing: SummaryListing;
  title: string;
  headline?: string | null;
  isOwner: boolean;
  priceDropText?: React.ReactNode;
  onMessage: () => void;
  onBid?: (() => void) | undefined;
  onOffer?: (() => void) | undefined;
}) {
  const auction = listing.sale_format === "auction";
  const ended = auction && auctionEnded({ auction_ends_at: listing.auction_ends_at ?? null });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!auction || ended) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [auction, ended]);

  const { data: stats } = useQuery({
    queryKey: ["seller-stats", listing.user_id],
    queryFn: () => fetchSellerStats(listing.user_id),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const price = auction
    ? formatPrice(listing.current_bid ?? listing.start_price ?? listing.price)
    : formatPrice(listing.price);
  const area = listing.location_district || listing.location_area;
  const collection = [
    listing.collection_available !== false && area ? `Collection from ${area}` : null,
    listing.postage_available
      ? listing.postage_price != null && Number(listing.postage_price) > 0
        ? `Postage ${formatPrice(listing.postage_price)}`
        : "Free postage"
      : null,
  ].filter(Boolean);
  const condition =
    listing.type === "part"
      ? (listing.item_condition && CONDITION_LABELS[listing.item_condition]) || "Used"
      : listing.mileage != null
        ? `Used · ${listing.mileage.toLocaleString("en-GB")} miles`
        : "Used";
  const active = listing.status === "active" && !ended;

  return (
    <section className="mt-5">
      {headline && <p className="text-sm font-semibold text-muted-foreground">{headline}</p>}
      <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight">{title}</h1>

      {listing.profiles && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <Link
            to="/u/$username"
            params={{ username: listing.profiles.username }}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <Avatar
              photoUrl={listing.profiles.avatar_url}
              fallback={listing.profiles.username}
              className="size-11"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate font-semibold">
                  {displayUsernameWithoutAt(listing.profiles.username)}
                </span>
                {stats && stats.sold_listings > 0 && (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {stats.sold_listings} sale{stats.sold_listings === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                {stats && stats.reviews_count > 0 ? (
                  <>
                    <Star className="size-3.5 text-amber-500" fill="currentColor" />
                    {Number(stats.rating_avg).toFixed(1)} · {stats.reviews_count} RevMate review
                    {stats.reviews_count === 1 ? "" : "s"}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-3.5" /> New to selling on RevMate
                  </>
                )}
              </span>
            </span>
          </Link>
          {!isOwner && (
            <button
              type="button"
              onClick={onMessage}
              className="shrink-0 rounded-full bg-muted px-4 py-2 text-sm font-semibold"
            >
              Chat
            </button>
          )}
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-muted/60 p-4">
        {auction && (
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Gavel className="size-3.5" /> {ended ? "Auction ended" : "Live auction"}
          </p>
        )}
        <p className="text-4xl font-extrabold tabular-nums tracking-tight">{price}</p>
        {auction ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
            <span className="rounded-full bg-background px-2.5 py-1 font-semibold">
              {listing.bid_count ?? 0} bid{listing.bid_count === 1 ? "" : "s"}
            </span>
            {!ended && listing.auction_ends_at && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 font-semibold tabular-nums">
                <Timer className="size-3.5" /> {timeLeft(listing.auction_ends_at, now)} left
              </span>
            )}
            <span className="rounded-full bg-background px-2.5 py-1 text-muted-foreground">
              {!listing.has_reserve
                ? "No reserve"
                : listing.reserve_met
                  ? "Reserve met"
                  : "Reserve not met"}
            </span>
          </div>
        ) : (
          <>
            {priceDropText}
            {listing.open_to_offers && active && (
              <p className="mt-1 text-sm font-medium text-muted-foreground">Open to offers</p>
            )}
          </>
        )}
      </div>

      {collection.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5">
          <MapPin className="mt-1 size-4 shrink-0 text-muted-foreground" />
          {collection.join(" · ")}
        </p>
      )}
      <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1">
        <dt className="text-muted-foreground">Condition</dt>
        <dd className="font-semibold">{condition}</dd>
      </dl>

      {!isOwner && active && (
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={onMessage}
            className="min-h-14 w-full rounded-full bg-primary text-lg font-semibold text-primary-foreground"
          >
            Message seller
          </button>
          {auction && onBid ? (
            <button
              type="button"
              onClick={onBid}
              className="min-h-14 w-full rounded-full border-2 border-primary text-lg font-semibold text-primary"
            >
              Place a bid
            </button>
          ) : onOffer && listing.open_to_offers ? (
            <button
              type="button"
              onClick={onOffer}
              className="min-h-14 w-full rounded-full border-2 border-primary text-lg font-semibold text-primary"
            >
              Make an offer
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
