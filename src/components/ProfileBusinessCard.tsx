import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ChevronRight, Store } from "lucide-react";
import { Stars } from "@/components/TrustBadge";
import { BUSINESS_CATEGORY_LABELS, fetchMyBusinesses } from "@/lib/businesses";
import {
  APPROVAL_LABELS,
  approvalOf,
  isLive,
  useBusinessFoundation,
} from "@/lib/businessFoundation";

/**
 * "Here's my business" on a member's profile. Everyone sees the approved businesses; the owner also
 * sees their own drafts and ones waiting for approval, marked as only visible to them.
 */
export function ProfileBusinessCard({
  ownerId,
  viewerIsOwner,
}: {
  ownerId: string;
  viewerIsOwner: boolean;
}) {
  const foundation = useBusinessFoundation();
  const { data } = useQuery({
    queryKey: ["businesses", "by-owner", ownerId],
    queryFn: () => fetchMyBusinesses(ownerId),
    enabled: foundation,
  });
  const shown = (data ?? []).filter((b) => viewerIsOwner || isLive(b));
  if (!foundation || shown.length === 0) return null;
  return (
    <section className="mt-6 border-t border-border pt-5">
      <h2 className="text-lg font-bold">
        {shown.length === 1 ? "Here's my business" : "My businesses"}
      </h2>
      <ul className="mt-3 space-y-2">
        {shown.map((b) => {
          const live = isLive(b);
          return (
            <li key={b.id}>
              <Link
                to="/businesses/$businessId"
                params={{ businessId: b.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                {b.logo_url ? (
                  <img
                    src={b.logo_url}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-contain"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Store className="size-6 text-muted-foreground" aria-hidden />
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
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {BUSINESS_CATEGORY_LABELS[b.category] ?? b.category}
                    {b.town ? ` · ${b.town}` : ""}
                  </span>
                  {live && b.reviews_count > 0 ? (
                    <span className="mt-0.5 flex items-center gap-1 text-xs">
                      <Stars rating={Number(b.rating_avg)} className="size-3.5" />{" "}
                      {Number(b.rating_avg).toFixed(1)} ({b.reviews_count})
                    </span>
                  ) : null}
                  {!live && (
                    <span className="mt-0.5 block text-xs font-medium text-amber-600 dark:text-amber-400">
                      {approvalOf(b).suspended_at
                        ? "Suspended"
                        : APPROVAL_LABELS[approvalOf(b).approval_status]}{" "}
                      · only you can see this
                    </span>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
