import { ExternalLink } from "lucide-react";
import { recordDealClick, useAdFree, useDeals, type DealPlacement } from "@/lib/money";

/**
 * Affiliate deals on the practical pages (never the feed). Clearly labelled
 * as ads, as UK advertising rules require, and hidden for Plus members.
 */
export function DealsStrip({
  placement,
  title = "Deals for your car",
}: {
  placement: DealPlacement;
  title?: string;
}) {
  const deals = useDeals(placement);
  const adFree = useAdFree();
  if (adFree || deals.length === 0) return null;
  return (
    <section aria-label={title} className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="text-[11px] text-muted-foreground">Ad · we may earn a commission</span>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
        {deals.map((d) => (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            onClick={() => recordDealClick(d.id)}
            className="flex w-64 shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              {d.image_url ? (
                <img
                  src={d.image_url}
                  alt=""
                  className="size-10 shrink-0 rounded-lg bg-white object-contain p-1"
                />
              ) : (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold">
                  {d.partner.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{d.partner}</p>
                <p className="truncate font-semibold">{d.title}</p>
              </div>
            </div>
            {d.blurb && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{d.blurb}</p>
            )}
            <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-primary">
              {d.cta} <ExternalLink className="size-3.5" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
