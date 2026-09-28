import { useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, Star } from "lucide-react";
import { recordAdEvent, type AdForMe } from "@/lib/businesses";

/**
 * A sponsored card from the admin ads manager. Always labelled
 * "Sponsored"; shows the business's member rating so people can judge it.
 * Counts one impression when it's actually seen, and clicks.
 */
export function AdCard({ ad, preview = false }: { ad: AdForMe; preview?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (preview || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
          recordAdEvent(ad.id, "impression");
          observer.disconnect();
        }
      },
      { threshold: [0.5] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id, preview]);

  function open() {
    if (preview) return;
    recordAdEvent(ad.id, "click");
    if (ad.cta_url.startsWith("/")) void navigate({ to: ad.cta_url });
    else window.open(ad.cta_url, "_blank", "noopener,noreferrer");
  }

  return (
    <article
      ref={ref}
      className="border-y border-border bg-card p-3 sm:rounded-lg sm:border sm:p-4"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded bg-muted px-1.5 py-0.5 font-semibold uppercase tracking-wide">
          Sponsored
        </span>
        {ad.business_name &&
          (ad.business_id && !preview ? (
            <Link
              to="/businesses/$businessId"
              params={{ businessId: ad.business_id }}
              className="flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              {ad.business_name}
              {ad.business_verified && <BadgeCheck className="size-3.5 text-primary" />}
            </Link>
          ) : (
            <span className="flex items-center gap-1 font-medium text-foreground">
              {ad.business_name}
              {ad.business_verified && <BadgeCheck className="size-3.5 text-primary" />}
            </span>
          ))}
        {!!ad.business_reviews && ad.business_reviews > 0 && (
          <span className="ml-auto flex items-center gap-0.5 font-semibold text-foreground">
            <Star className="size-3.5 text-amber-500" fill="currentColor" />
            {Number(ad.business_rating).toFixed(1)}
            <span className="font-normal text-muted-foreground">({ad.business_reviews})</span>
          </span>
        )}
      </div>
      {ad.image_url && (
        <button
          type="button"
          onClick={open}
          className="-mx-3 mt-2 block w-[calc(100%+1.5rem)] sm:mx-0 sm:w-full"
        >
          <img
            src={ad.image_url}
            alt=""
            loading="lazy"
            className="aspect-[16/9] w-full object-cover sm:rounded-md"
          />
        </button>
      )}
      <p className="mt-2 font-semibold">{ad.headline || "Your headline"}</p>
      {ad.body && <p className="mt-0.5 text-sm text-muted-foreground">{ad.body}</p>}
      <button
        type="button"
        onClick={open}
        className="mt-3 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {ad.cta_label || "Find out more"}
      </button>
    </article>
  );
}
