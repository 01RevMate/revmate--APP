import { ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { trustLevel, type Business } from "@/lib/businesses";

export function Stars({ rating, className = "size-3.5" }: { rating: number; className?: string }) {
  return (
    <span className="inline-flex" aria-label={`${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`${className} ${n <= Math.round(rating) ? "text-amber-500" : "text-muted-foreground/40"}`}
          fill="currentColor"
        />
      ))}
    </span>
  );
}

/** RevMate's trust signal from member reviews and reports. */
export function TrustBadge({
  business,
}: {
  business: Pick<Business, "rating_avg" | "reviews_count" | "reports_count">;
}) {
  const level = trustLevel(business);
  if (level === "trusted")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="size-3.5" /> Trusted by members
      </span>
    );
  if (level === "caution")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
        <ShieldAlert className="size-3.5" /> Mixed feedback — read reviews
      </span>
    );
  return null;
}
