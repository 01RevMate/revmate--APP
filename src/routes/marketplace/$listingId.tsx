import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Eye,
  Flag,
  Heart,
  Loader2,
  MessageCircle,
  Send,
  Settings2,
  Star,
  ThumbsDown,
  Users,
} from "lucide-react";
import { endListing, fetchListingById, type ListingEndReason } from "@/lib/listings";
import {
  changeListingPrice,
  fetchMyWatchlistIds,
  formatPrice,
  hasRecentPriceDrop,
  isFeatured,
  recordListingView,
  rememberViewedListing,
  setListingFeatured,
  unwatchListing,
  useMarketplaceFeatures,
  watchListing,
} from "@/lib/marketplace";
import { fetchOrCreateConversation, sendMessage } from "@/lib/messages";
import { reportSeller, SELLER_REPORT_REASONS, type SellerReportReason } from "@/lib/sellers";
import { carLabel, carPath } from "@/lib/cars";
import { Avatar } from "@/components/Avatar";
import { ListingGallery } from "@/components/ListingGallery";
import { ListingBusinessCard } from "@/components/ListingBusinessCard";
import { ListingSpecHighlights, ListingSpecSheet } from "@/components/ListingSpecSheet";
import { displayUsername, displayUsernameWithoutAt } from "@/lib/usernames";
import { useAuth } from "@/hooks/useAuth";
import { AGE_LIMITS, useOldEnough } from "@/lib/legal";

import { absoluteUrl, breadcrumbs, pickShareImage, seo } from "@/lib/seo";
import { fetchListingSeo, type ListingSeo } from "@/lib/seoData";
import { useAuthModal } from "@/hooks/useAuthModal";
import { useProfile } from "@/hooks/useProfile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/marketplace/$listingId")({
  // Loaded on the server so shared links show the photo, price and car.
  loader: ({ params }) => fetchListingSeo(params.listingId),
  head: ({ params, loaderData }) => listingHead(params.listingId, loaderData ?? null),
  component: ListingDetailPage,
});

function ListingDetailPage() {
  const { listingId } = Route.useParams();
  const { user } = useAuth();
  const oldEnoughToBuy = useOldEnough(AGE_LIMITS.selling);
  const { open: openAuthModal } = useAuthModal();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [endingReason, setEndingReason] = useState<ListingEndReason | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<SellerReportReason>("scam");
  const [reportDetails, setReportDetails] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: () => fetchListingById(listingId),
  });

  const market = useMarketplaceFeatures();
  const { isAdmin } = useProfile();
  const watchKey = ["watchlist-ids", user?.id];
  const { data: watchIds } = useQuery({
    queryKey: watchKey,
    queryFn: () => fetchMyWatchlistIds(user!.id),
    enabled: market && !!user,
  });
  const [newPrice, setNewPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Count the view (once a day per person) and remember it for
  // "Pick up where you left off" on the Buy & Sell page.
  const loadedId = listing?.id;
  useEffect(() => {
    if (!loadedId) return;
    rememberViewedListing(loadedId);
    if (market && user) void recordListingView(loadedId);
  }, [loadedId, market, user]);

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
  const watched = watchIds?.has(listing.id) ?? false;

  async function toggleWatch() {
    if (!listing) return;
    if (!user)
      return openAuthModal("Create a free account to watch listings and get price-drop alerts.");
    try {
      if (watched) await unwatchListing(listing.id, user.id);
      else {
        await watchListing(listing.id, user.id);
        toast.success("Watching — we'll tell you if the price drops");
      }
      queryClient.invalidateQueries({ queryKey: watchKey });
      queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your watchlist");
    }
  }

  async function handleFeature(days: number | null) {
    if (!listing) return;
    try {
      await setListingFeatured(listing.id, days);
      toast.success(days ? `Featured for ${days} days` : "No longer featured");
      queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change Featured");
    }
  }

  async function handleChangePrice(e: React.FormEvent) {
    e.preventDefault();
    if (!listing) return;
    const value =
      newPrice.trim() === "" ? null : Math.round(Number(newPrice.replace(/[£,\s]/g, "")));
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.error("Enter a price in pounds, or leave it blank for POA.");
      return;
    }
    setSavingPrice(true);
    try {
      await changeListingPrice(listing.id, value);
      toast.success(
        value !== null && listing.price != null && value < Number(listing.price)
          ? "Price dropped — watchers have been told"
          : "Price updated",
      );
      setNewPrice("");
      queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change the price");
    } finally {
      setSavingPrice(false);
    }
  }

  const carName = listing.garage_cars
    ? `${listing.garage_cars.year ? `${listing.garage_cars.year} ` : ""}${listing.garage_cars.make} ${listing.garage_cars.model}`
    : listing.title;

  const QUICK_QUESTIONS = [
    `Hi! Is the ${carName} still available?`,
    `What's the lowest you'd take for the ${carName}?`,
    `Can I come and view the ${carName} this week?`,
    `Has the ${carName} got full service history?`,
  ];

  function openMessageDialog() {
    if (!user) {
      openAuthModal("Create a free account to message the seller.");
      return;
    }
    if (!oldEnoughToBuy) {
      toast.error(`Buying and selling on RevMate is for people aged ${AGE_LIMITS.selling} and over.`);
      return;
    }
    setMessageBody(QUICK_QUESTIONS[0]!);
    setMessageOpen(true);
  }

  async function handleSendMessage() {
    if (!user || !listing?.profiles || !messageBody.trim() || sendingMessage) return;
    setSendingMessage(true);
    try {
      const conversationId = await fetchOrCreateConversation(user.id, listing.user_id);
      await sendMessage(conversationId, user.id, messageBody.trim());
      await queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
      toast.success("Message sent to the seller");
      setMessageOpen(false);
      navigate({
        to: "/messages/$username",
        params: { username: listing.profiles.username },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your message");
    } finally {
      setSendingMessage(false);
    }
  }

  function openReportDialog() {
    if (!user) {
      openAuthModal("Create a free account to report a seller.");
      return;
    }
    setReportReason("scam");
    setReportDetails("");
    setReportOpen(true);
  }

  async function handleSendReport() {
    if (!user || !listing || sendingReport) return;
    setSendingReport(true);
    try {
      await reportSeller({
        listingId: listing.id,
        sellerId: listing.user_id,
        reporterId: user.id,
        reason: reportReason,
        details: reportDetails,
      });
      toast.success("Report sent. Our team will take a look.");
      setReportOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your report");
    } finally {
      setSendingReport(false);
    }
  }

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

      <ListingGallery photos={listing.photos} title={carName} />

      <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {listing.headline && (
            <p className="text-sm font-semibold text-muted-foreground">{listing.headline}</p>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{carName}</h1>
          {listing.mileage != null && !listing.year && (
            <p className="text-sm text-muted-foreground">
              {listing.mileage.toLocaleString()} miles
            </p>
          )}
          {listing.type === "car" && <ListingSpecHighlights specs={listing} />}
        </div>
        <div className="text-right">
          <p className="text-3xl font-extrabold tracking-tight">{formatPrice(listing.price)}</p>
          {hasRecentPriceDrop(listing) && (
            <p className="text-sm">
              <span className="text-muted-foreground line-through">
                {formatPrice(listing.previous_price)}
              </span>{" "}
              <span className="font-bold text-red-600">
                Save {formatPrice(Number(listing.previous_price) - Number(listing.price))}
              </span>
            </p>
          )}
          {market && (
            <p className="mt-0.5 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              {listing.views_count > 0 && (
                <span className="flex items-center gap-0.5">
                  <Eye className="size-3.5" /> {listing.views_count} views
                </span>
              )}
              {listing.saves_count > 0 && (
                <span className="flex items-center gap-0.5">
                  <Heart className="size-3.5" /> {listing.saves_count} watching
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {market && !isOwner && (
        <button
          type="button"
          onClick={() => void toggleWatch()}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-colors ${watched ? "border-red-500/40 bg-red-500/10 text-red-600" : "border-input hover:bg-accent"}`}
        >
          <Heart className="size-4" fill={watched ? "currentColor" : "none"} />
          {watched
            ? "Watching — we'll alert you if the price drops"
            : "Watch this — get price-drop alerts"}
        </button>
      )}
      {market && isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 p-2 text-xs">
          <span className="font-semibold">Admin · Featured:</span>
          {isFeatured(listing) ? (
            <>
              <span>until {new Date(listing.featured_until!).toLocaleDateString("en-GB")}</span>
              <button type="button" onClick={() => void handleFeature(null)} className="underline">
                Remove
              </button>
            </>
          ) : (
            [7, 14, 30].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => void handleFeature(days)}
                className="rounded-full border border-amber-500/60 px-2 py-0.5 font-semibold hover:bg-amber-400/20"
              >
                {days} days
              </button>
            ))
          )}
        </div>
      )}
      {isOwner && isFeatured(listing) && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-amber-600">
          <Star className="size-4" fill="currentColor" /> Featured — pinned to the top of Buy & Sell
        </p>
      )}

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

      {listing.business_id && <ListingBusinessCard businessId={listing.business_id} />}

      {listing.type === "car" && <ListingSpecSheet specs={listing} />}

      {listing.cars && (
        <Link
          {...carPath(listing.cars)}
          className="mt-4 inline-block text-sm text-primary underline"
        >
          View {carLabel(listing.cars)} specs & common faults
        </Link>
      )}

      {listing.profiles && (
        <div className="mt-8 rounded-lg border border-border p-3">
          <Link
            to="/u/$username"
            params={{ username: listing.profiles.username }}
            className="flex items-center gap-3 rounded-md p-1 hover:bg-accent"
          >
            <Avatar photoUrl={listing.profiles.avatar_url} fallback={listing.profiles.username} />
            <div>
              <p className="text-xs text-muted-foreground">Listed by</p>
              <p className="text-sm font-medium">{displayUsername(listing.profiles.username)}</p>
            </div>
          </Link>
          {!isOwner && listing.status === "active" && (
            <>
              <button
                type="button"
                onClick={openMessageDialog}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <MessageCircle className="size-4" />
                Message seller
              </button>
              <button
                type="button"
                onClick={openReportDialog}
                className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
              >
                <Flag className="size-3.5" />
                Report this seller
              </button>
            </>
          )}
        </div>
      )}

      <Dialog open={messageOpen} onOpenChange={(open) => !sendingMessage && setMessageOpen(open)}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Message {displayUsernameWithoutAt(listing.profiles?.username ?? "")}
            </DialogTitle>
            <DialogDescription>
              Pick a question or write your own about the {carName}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setMessageBody(question)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  messageBody === question
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-accent"
                }`}
              >
                {question}
              </button>
            ))}
          </div>
          <textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Write your message…"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleSendMessage()}
            disabled={sendingMessage || !messageBody.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {sendingMessage ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {sendingMessage ? "Sending…" : "Send message"}
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={(open) => !sendingReport && setReportOpen(open)}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report this seller</DialogTitle>
            <DialogDescription>
              Tell us what's wrong with this advert. Reports are reviewed by the RevMate team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {(Object.entries(SELLER_REPORT_REASONS) as [SellerReportReason, string][]).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReportReason(value)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    reportReason === value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Add any details (optional)…"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void handleSendReport()}
            disabled={sendingReport}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {sendingReport ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Flag className="size-4" />
            )}
            {sendingReport ? "Sending…" : "Send report"}
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen} onOpenChange={(open) => !endingReason && setManageOpen(open)}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-md">
          <form onSubmit={handleChangePrice} className="space-y-2 border-b border-border pb-4">
            <p className="text-sm font-semibold">Change price</p>
            <div className="flex gap-2">
              <input
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                inputMode="numeric"
                placeholder={
                  listing.price != null ? `Now ${formatPrice(listing.price)}` : "e.g. 12500"
                }
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <button
                disabled={savingPrice}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {savingPrice ? "Saving…" : "Save"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Lower it and it shows as a price drop, and everyone watching gets an alert.
            </p>
          </form>
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

function listingHead(listingId: string, listing: ListingSeo | null) {
  const path = `/marketplace/${listingId}`;
  if (!listing) {
    return seo({
      title: "Listing not available — RevMate",
      description: "This listing has sold or been removed. Browse more cars and parts on RevMate.",
      path,
      noindex: true,
    });
  }
  const price = listing.price != null ? formatPrice(listing.price) : null;
  const car = listing.car;
  const facts = [
    car?.year,
    car ? `${car.make} ${car.model}` : null,
    listing.mileage != null ? `${listing.mileage.toLocaleString("en-GB")} miles` : null,
    listing.location_area,
  ].filter(Boolean);
  const title = `${price ? `${price} · ` : ""}${listing.title} — RevMate`;
  const description = [
    listing.headline || listing.description,
    facts.length ? `${facts.join(" · ")}.` : null,
    `For sale on RevMate${listing.seller ? ` by ${displayUsername(listing.seller)}` : ""}.`,
  ]
    .filter(Boolean)
    .join(" ");
  const images = listing.photos.filter((url) => pickShareImage(url));
  const url = absoluteUrl(path);
  const isCar = listing.type === "car";
  const product = {
    "@context": "https://schema.org",
    "@type": isCar ? ["Product", "Car"] : "Product",
    name: listing.title,
    description: listing.description || listing.headline || listing.title,
    ...(images.length ? { image: images } : {}),
    url,
    ...(car ? { brand: { "@type": "Brand", name: car.make }, model: car.model } : {}),
    ...(isCar && car?.year ? { vehicleModelDate: String(car.year) } : {}),
    ...(isCar && listing.mileage != null
      ? {
          mileageFromOdometer: {
            "@type": "QuantitativeValue",
            value: listing.mileage,
            unitCode: "SMI",
          },
        }
      : {}),
    ...(listing.price != null
      ? {
          offers: {
            "@type": "Offer",
            price: Number(listing.price),
            priceCurrency: "GBP",
            availability: "https://schema.org/InStock",
            itemCondition: "https://schema.org/UsedCondition",
            url,
            ...(listing.seller
              ? { seller: { "@type": "Person", name: displayUsername(listing.seller) } }
              : {}),
          },
        }
      : {}),
  };
  return seo({
    title,
    description,
    path,
    image: images[0] ?? null,
    imageAlt: listing.title,
    type: "product",
    extraMeta:
      listing.price != null
        ? [
            { property: "product:price:amount", content: String(Number(listing.price)) },
            { property: "product:price:currency", content: "GBP" },
            { property: "product:availability", content: "in stock" },
            { property: "product:condition", content: "used" },
          ]
        : [],
    jsonLd: [
      product,
      breadcrumbs([
        { name: "Buy & Sell", path: "/marketplace" },
        { name: listing.title, path },
      ]),
    ],
  });
}
