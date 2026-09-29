import { Link } from "@tanstack/react-router";
import type { PostWithAuthor } from "@/lib/posts";

/**
 * The price/headline/"view full listing" block for a `for_sale` post.
 * Shared between PostCard and RepostedPost so a share/repost of a for-sale
 * post carries the same listing details instead of just the caption + a photo.
 */
export function ForSaleListingBox({
  post,
  edgeClassName,
  viewerId,
}: {
  post: Pick<PostWithAuthor, "listings" | "posted_as_garage_car" | "user_id">;
  /** Negative-margin class(es) to bleed the box edge-to-edge in its container. */
  edgeClassName: string;
  viewerId?: string | null | undefined;
}) {
  if (!post.listings) return null;
  return (
    <>
      <div className={`mt-3 flex items-center justify-between gap-3 bg-muted px-4 py-3 ${edgeClassName}`}>
        <div>
          {viewerId && viewerId === post.user_id && (
            <span className="mb-1 inline-block rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              This is your ad
            </span>
          )}
          {post.posted_as_garage_car && (
            <p className="text-sm font-semibold text-foreground">
              {post.posted_as_garage_car.year ? `${post.posted_as_garage_car.year} ` : ""}
              {post.posted_as_garage_car.make} {post.posted_as_garage_car.model}
            </p>
          )}
          <p className="text-2xl font-bold text-foreground">
            {post.listings.price != null ? `£${post.listings.price.toLocaleString("en-GB")}` : "POA"}
          </p>
        </div>
        {post.listings.headline && (
          <p className="max-w-[55%] text-right text-sm font-medium italic text-foreground/80">
            {post.listings.headline}
          </p>
        )}
      </div>
      <Link
        to="/marketplace/$listingId"
        params={{ listingId: post.listings.id }}
        onClick={(e) => e.stopPropagation()}
        className={`block bg-blue-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-600 ${edgeClassName}`}
      >
        View full listing →
      </Link>
    </>
  );
}
