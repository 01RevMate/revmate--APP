import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { leaveSellerReview } from "@/lib/marketDeals";
import { displayUsername } from "@/lib/usernames";

export const Route = createFileRoute("/review/$listingId")({
  head: () => ({
    meta: [{ title: "Review your purchase — RevMate" }, { name: "robots", content: "noindex" }],
  }),
  component: ReviewPage,
});

async function fetchSale(listingId: string) {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, photos, user_id, buyer_id, status")
    .eq("id", listingId)
    .maybeSingle();
  if (error) throw error;
  if (!listing) return null;
  const [{ data: seller }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("username").eq("user_id", listing.user_id).maybeSingle(),
    supabase
      .from("seller_reviews")
      .select("rating, body")
      .eq("listing_id", listingId)
      .maybeSingle(),
  ]);
  return { listing, seller: seller?.username ?? null, existing };
}

/** The buyer of a "Sold through RevMate" listing rates the seller. */
function ReviewPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sale-review", listingId],
    queryFn: () => fetchSale(listingId),
  });
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (isLoading)
    return <p className="mx-auto max-w-md px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  const isBuyer = !!data && !!user && data.listing.buyer_id === user.id;
  if (!data || !isBuyer) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-semibold">This review link isn't for you</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only the person who bought the item can review the sale.
        </p>
        <Link to="/marketplace" className="mt-4 inline-block text-sm text-primary underline">
          Back to Buy & Sell
        </Link>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      toast.error("Pick 1 to 5 stars.");
      return;
    }
    setBusy(true);
    try {
      await leaveSellerReview(listingId, rating, body);
      void queryClient.invalidateQueries({ queryKey: ["seller-reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["seller-stats"] });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
        {data.listing.photos?.[0] && (
          <img src={data.listing.photos[0]} alt="" className="size-16 rounded-lg object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">You bought</p>
          <p className="truncate font-semibold">{data.listing.title}</p>
          {data.seller && (
            <p className="text-xs text-muted-foreground">from {displayUsername(data.seller)}</p>
          )}
        </div>
      </div>
      {done ? (
        <div className="mt-6 text-center">
          <p className="text-lg font-semibold">Thanks for your review!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It helps other members buy with confidence.
          </p>
          <Link to="/marketplace" className="mt-4 inline-block text-sm text-primary underline">
            Back to Buy & Sell
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <h1 className="text-xl font-semibold">
            {data.existing ? "Update your review" : "How did the sale go?"}
          </h1>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(n)}
                className="p-1 text-amber-500"
              >
                <Star
                  className="size-9"
                  fill={n <= (rating || data.existing?.rating || 0) ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Was it as described? Easy to deal with? (optional)"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Reviews are public and show on the seller's adverts. Keep it honest and about the sale.
          </p>
          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Post review
          </button>
        </form>
      )}
    </div>
  );
}
