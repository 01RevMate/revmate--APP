import { ShieldAlert, ShieldCheck, Star } from "lucide-react";
import { trustLevel, type Business } from "@/lib/businesses";
import type { BusinessTrustFields } from "@/lib/businessFoundation";

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

/**
 * RevMate's trust signal from member reviews and upheld reports. It is NOT a guarantee of the work:
 * "Highly rated" only means a good run of reviews from real members and no upheld reports.
 * When the database provides `trust_level` (migration 0081) that is used; otherwise the older rule.
 */
export function TrustBadge({
  business,
}: {
  business: Pick<Business, "rating_avg" | "reviews_count" | "reports_count"> & {
    trust_level?: BusinessTrustFields["trust_level"] | string | null;
  };
}) {
  const level = business.trust_level ?? trustLevel(business);
  if (level === "trusted")
    return (
      <span
        title="Five or more reviews from members, averaging 4.3 or higher, and no upheld reports. RevMate doesn't vouch for the quality of anyone's work."
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
      >
        <ShieldCheck className="size-3.5" /> Highly rated by members
      </span>
    );
  if (level === "caution")
    return (
      <span
        title="Low ratings or several upheld reports. Read the reviews before you decide."
        className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300"
      >
        <ShieldAlert className="size-3.5" /> Mixed feedback — read reviews
      </span>
    );
  return null;
}
