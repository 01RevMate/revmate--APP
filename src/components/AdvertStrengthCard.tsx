import { Link } from "@tanstack/react-router";
import { Circle, Pencil, TrendingUp } from "lucide-react";
import { advertStrength } from "@/lib/marketDeals";
import type { MarketListing } from "@/lib/marketplace";

/** For the seller: how strong the advert is and what would push it higher. */
export function AdvertStrengthCard({ listing }: { listing: MarketListing }) {
  const { score, checks } = advertStrength(listing);
  const missing = checks.filter((c) => !c.done);
  const tone = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" /> Advert strength
        </p>
        <span className="text-sm font-bold">{score}/100</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${score}%` }} />
      </div>
      {missing.length > 0 ? (
        <>
          <p className="mt-3 text-xs text-muted-foreground">
            Stronger adverts show higher in Buy & Sell. Add these to move up:
          </p>
          <ul className="mt-1.5 space-y-1 text-sm">
            {missing.map((c) => (
              <li key={c.label} className="flex items-center gap-1.5">
                <Circle className="size-3 text-muted-foreground" />
                {c.label}
                <span className="text-xs text-muted-foreground">+{c.points}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/marketplace/$listingId/edit"
            params={{ listingId: listing.id }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            <Pencil className="size-3.5" /> Improve advert
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
          Brilliant — your advert has everything buyers look for.
        </p>
      )}
    </div>
  );
}
