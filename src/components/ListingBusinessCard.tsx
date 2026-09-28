import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Store } from "lucide-react";
import { Stars, TrustBadge } from "@/components/TrustBadge";
import { BUSINESS_CATEGORY_LABELS, fetchBusiness } from "@/lib/businesses";

/** For trade listings linked to a business: who's selling and how members rate them. */
export function ListingBusinessCard({ businessId }: { businessId: string }) {
  const { data: b } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => fetchBusiness(businessId),
  });
  if (!b) return null;
  return (
    <Link
      to="/businesses/$businessId"
      params={{ businessId: b.id }}
      className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-accent/50"
    >
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
        {b.logo_url ? (
          <img src={b.logo_url} alt="" className="size-full object-cover" />
        ) : (
          <Store className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Sold by</p>
        <p className="flex items-center gap-1 font-semibold">
          {b.name}
          {b.verified && <BadgeCheck className="size-4 text-primary" />}
        </p>
        <p className="text-xs text-muted-foreground">
          {BUSINESS_CATEGORY_LABELS[b.category] ?? b.category}
          {b.town ? ` · ${b.town}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {b.reviews_count > 0 ? (
            <span className="flex items-center gap-1">
              <Stars rating={Number(b.rating_avg)} /> {Number(b.rating_avg).toFixed(1)} (
              {b.reviews_count} reviews)
            </span>
          ) : (
            <span className="text-muted-foreground">No member reviews yet</span>
          )}
          <TrustBadge business={b} />
        </div>
      </div>
    </Link>
  );
}
