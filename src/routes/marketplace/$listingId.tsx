import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Heart, Loader2, Settings2, ThumbsDown, Users } from "lucide-react";
import { endListing, fetchListingById, type ListingEndReason } from "@/lib/listings";
import { carLabel, carPath } from "@/lib/cars";
import { Avatar } from "@/components/Avatar";
import { displayUsername } from "@/lib/usernames";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/marketplace/$listingId")({
  head: () => ({
    meta: [
      { title: "Listing — RevMate" },
      { name: "description", content: "A car or part for sale on RevMate." },
    ],
  }),
  component: ListingDetailPage,
});

function ListingDetailPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [endingReason, setEndingReason] = useState<ListingEndReason | null>(null);
  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => fetchListingById(listingId),
  });

  if (isLoading) {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</p>;
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-xl font-semibold">Listing not found</h1>
        <Link
          to="/marketplace"
          className="mt-2 inline-block text-sm text-muted-foreground underline"
        >
          Back to Buy & Sell
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === listing.user_id;

  async function handleEndListing(reason: ListingEndReason) {
    if (!user || !listing || endingReason) return;
    setEndingReason(reason);
    try {
      const warnings = await endListing({
        listingId: listing.id,
        userId: user.id,
        garageCarId: listing.garage_car_id,
        reason,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["listings"] }),
        queryClient.invalidateQueries({ queryKey: ["listing", listing.id] }),
        queryClient.invalidateQueries({ queryKey: ["feed"] }),
        queryClient.invalidateQueries({ queryKey: ["garage"] }),
        queryClient.invalidateQueries({ queryKey: ["garage-car-listing"] }),
      ]);
      toast.success(
        reason === "sold_revmate"
          ? "Marked as sold through RevMate"
          : reason === "sold_elsewhere"
            ? "Marked as sold elsewhere"
            : "Advert removed from sale",
      );
      warnings.forEach((warning) => toast.warning(warning));
      setManageOpen(false);
      navigate({ to: "/marketplace" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't end this advert");
    } finally {
      setEndingReason(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Buy & Sell
        </Link>
        {isOwner && (
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Settings2 className="size-4" />
            Manage advert
          </button>
        )}
      </div>

      {listing.photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-1 overflow-hidden rounded-lg sm:grid-cols-3">
          {listing.photos.map((url, index) => (
            <div
              key={url}
              className={`aspect-square bg-muted ${index === 0 ? "col-span-2 row-span-2 aspect-video sm:col-span-2 sm:row-span-2" : ""}`}
            >
              <img src={url} alt="" className="size-full object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {listing.headline && (
            <p className="text-sm font-semibold text-muted-foreground">{listing.headline}</p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">
            {listing.garage_cars
              ? `${listing.garage_cars.year ? `${listing.garage_cars.year} ` : ""}${listing.garage_cars.make} ${listing.garage_cars.model}`
              : listing.title}
          </h1>
          {listing.mileage != null && (
            <p className="text-sm text-muted-foreground">
              {listing.mileage.toLocaleString()} miles
            </p>
          )}
        </div>
        <p className="text-3xl font-bold">
          {listing.price != null ? `£${listing.price.toLocaleString("en-GB")}` : "POA"}
        </p>
      </div>

      {listing.show_car_stats && listing.garage_cars && (
        <div className="mt-3 flex items-center gap-4 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Heart className="size-4" />
            {listing.garage_cars.likes_count}
          </span>
          <span className="flex items-center gap-1.5">
            <ThumbsDown className="size-4" />
            {listing.garage_cars.dislikes_count}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {listing.garage_cars.followers_count}
          </span>
        </div>
      )}

      {listing.description && (
        <p className="mt-6 whitespace-pre-wrap text-sm">{listing.description}</p>
      )}

      {listing.cars && (
        <Link
          {...carPath(listing.cars)}
          className="mt-4 inline-block text-sm text-primary underline"
        >
          View {carLabel(listing.cars)} specs & common faults
        </Link>
      )}

      {listing.profiles && (
        <Link
          to="/u/$username"
          params={{ username: listing.profiles.username }}
          className="mt-8 flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent"
        >
          <Avatar photoUrl={listing.profiles.avatar_url} fallback={listing.profiles.username} />
          <div>
            <p className="text-xs text-muted-foreground">Listed by</p>
            <p className="text-sm font-medium">{displayUsername(listing.profiles.username)}</p>
          </div>
        </Link>
      )}

      <Dialog open={manageOpen} onOpenChange={(open) => !endingReason && setManageOpen(open)}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End this advert</DialogTitle>
            <DialogDescription>
              Choose what happened. The advert and its selling post will stop appearing publicly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(
              [
                ["sold_revmate", "Sold through RevMate", "The buyer found it here."],
                ["sold_elsewhere", "Sold elsewhere", "It sold through another place."],
                ["withdrawn", "No longer selling", "Keep the car and remove the advert."],
                ["other", "Other reason", "Remove it from sale for another reason."],
              ] as const
            ).map(([reason, title, description]) => (
              <button
                key={reason}
                type="button"
                onClick={() => handleEndListing(reason)}
                disabled={endingReason !== null}
                className="flex min-h-14 items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-accent disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
                {endingReason === reason && <Loader2 className="size-4 shrink-0 animate-spin" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
