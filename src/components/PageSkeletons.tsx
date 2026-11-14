import { Skeleton } from "@/components/ui/skeleton";
import { PostCardSkeleton } from "@/components/PostCardSkeleton";

/** Shaped like MarketListingCard: 4:3 photo, price, title and a detail line. */
export function ListingCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

/** Shaped like the listing page: gallery, thumbnails, title, price and description. */
export function ListingDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" aria-busy="true" aria-label="Loading listing">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 aspect-[4/3] w-full rounded-2xl" />
      <div className="mt-3 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="size-20 shrink-0 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-7 w-2/3" />
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-[68px] w-48 rounded-lg" />
      <div className="mt-6 space-y-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** Shaped like a profile: cover, avatar, name, stats and a garage grid. */
export function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-3xl" aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-40 w-full rounded-none sm:h-56" />
      <div className="px-4">
        <Skeleton className="-mt-10 size-20 rounded-full border-4 border-background" />
        <Skeleton className="mt-3 h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-24" />
        <div className="mt-4 flex gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-16" />
          ))}
        </div>
        <Skeleton className="mt-8 h-6 w-24" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A few post cards, for feeds and group discussions. */
export function PostListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} media={i === 0} />
      ))}
    </div>
  );
}

/** Generic page: a heading, some text and a couple of content blocks. */
export function PageSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`mx-auto px-4 py-10 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-56" />
      <div className="mt-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <Skeleton className="mt-8 h-40 w-full rounded-xl" />
      <Skeleton className="mt-4 h-24 w-full rounded-xl" />
    </div>
  );
}
