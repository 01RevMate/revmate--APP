import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import {
  BadgePoundSterling,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Fuel,
  GitCompareArrows,
  Leaf,
  Loader2,
  MessageCircle,
  Package,
  ShieldCheck,
  Star,
  Tag,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CONDITION_LABELS,
  deliveryLabel,
  fetchBuyerCandidates,
  fetchOffersForListing,
  fetchSellerReviews,
  fetchSellerStats,
  makeOffer,
  MAX_COMPARE,
  PART_CATEGORY_LABELS,
  replyTimeLabel,
  respondToOffer,
  setListingBuyer,
  type Offer,
  useCompareList,
} from "@/lib/marketDeals";
import {
  formatPrice,
  recordPartnerClick,
  type MarketListing,
  type Partner,
} from "@/lib/marketplace";
import type { Tables } from "@/integrations/supabase/types";
import { displayUsername } from "@/lib/usernames";

type ListingRow = Tables<"listings">;

/** Reg lookup isn't in the app yet — point buyers at the official MOT checker. */
export function MotHistoryCard() {
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ClipboardCheck className="size-5 text-primary" /> MOT history
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
          In-app coming soon
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        See every MOT pass, fail, advisory and the recorded mileage for free on GOV.UK. Ask the
        seller for the registration. MOT history inside RevMate is coming soon.
      </p>
      <a
        href="https://www.check-mot.service.gov.uk/"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Check MOT history on GOV.UK <ExternalLink className="size-3.5" />
      </a>
    </div>
  );
}

export function RunningCostsCard({
  listing,
  partners,
}: {
  listing: ListingRow;
  partners: Partner[] | undefined;
}) {
  const historyPartner = partners?.find((p) => /history|hpi|check/i.test(`${p.name} ${p.tagline}`));
  const rows = [
    { Icon: Fuel, label: "Fuel economy", value: listing.mpg ? `${Number(listing.mpg)} mpg` : null },
    { Icon: Leaf, label: "CO₂", value: listing.co2_gkm != null ? `${listing.co2_gkm} g/km` : null },
    {
      Icon: ShieldCheck,
      label: "Insurance group",
      value: listing.insurance_group ? `Group ${listing.insurance_group} of 50` : null,
    },
  ].filter((r) => r.value);
  return (
    <div className="mt-6 rounded-xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">Running costs</h2>
      {rows.length > 0 ? (
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                <r.Icon className="size-3.5" /> {r.label}
              </dt>
              <dd className="text-sm font-semibold">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          The seller hasn't added MPG, CO₂ or insurance group. Ask them.
        </p>
      )}
      <ul className="mt-3 space-y-1.5 text-sm">
        <li>
          <a
            href="https://www.gov.uk/vehicle-tax-rate-tables"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline"
          >
            Road tax rates on GOV.UK <ExternalLink className="size-3" />
          </a>{" "}
          <span className="text-muted-foreground">(depends on CO₂ and first registration)</span>
        </li>
        {historyPartner && (
          <li>
            <a
              href={historyPartner.url}
              target="_blank"
              rel="noopener sponsored"
              onClick={() => recordPartnerClick(historyPartner.id)}
              className="inline-flex items-center gap-1 font-medium text-primary underline"
            >
              {historyPartner.cta || "Get a history check"} with {historyPartner.name}{" "}
              <ExternalLink className="size-3" />
            </a>{" "}
            <span className="text-xs text-muted-foreground">Sponsored</span>
          </li>
        )}
      </ul>
    </div>
  );
}

export function PartDetailsCard({ listing }: { listing: ListingRow }) {
  const delivery = deliveryLabel(listing);
  const rows = [
    {
      Icon: Tag,
      label: "Category",
      value: listing.part_category ? PART_CATEGORY_LABELS[listing.part_category] : null,
    },
    {
      Icon: Package,
      label: "Condition",
      value: listing.item_condition ? CONDITION_LABELS[listing.item_condition] : null,
    },
    { Icon: Truck, label: "Delivery", value: delivery },
  ].filter((r) => r.value);
  if (!rows.length) return null;
  return (
    <dl className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start gap-2">
          <r.Icon className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="text-sm font-semibold">{r.value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function OfferStatus({ offer }: { offer: Offer }) {
  const map: Record<string, [string, string]> = {
    pending: ["Waiting for the seller", "bg-amber-500/15 text-amber-700 dark:text-amber-400"],
    countered: ["Counter-offer", "bg-sky-600/10 text-sky-700 dark:text-sky-400"],
    accepted: ["Accepted", "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"],
    declined: ["Declined", "bg-muted text-muted-foreground"],
    withdrawn: ["Withdrawn", "bg-muted text-muted-foreground"],
  };
  const [label, className] = map[offer.status] ?? [offer.status, "bg-muted"];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${className}`}>{label}</span>
  );
}

/**
 * Buyer: make an offer and follow it. Seller: see offers and accept,
 * decline or counter. Each step also notifies the other person.
 */
export function OfferPanel({
  listing,
  userId,
  isOwner,
  onNeedAccount,
  onMessage,
}: {
  listing: ListingRow;
  userId: string | null;
  isOwner: boolean;
  onNeedAccount: () => void;
  onMessage: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const key = ["listing-offers", listing.id, userId];
  const { data: offers } = useQuery({
    queryKey: key,
    queryFn: () => fetchOffersForListing(listing.id),
    enabled: !!userId,
    refetchInterval: 60_000,
  });
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<Offer | null>(null);
  const [counter, setCounter] = useState("");
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });

  if (!listing.open_to_offers && !isOwner) return null;
  const asking = listing.price != null ? Number(listing.price) : null;
  const mine = offers?.find((o) => o.buyer_id === userId);
  const openOffer =
    mine && (mine.status === "pending" || mine.status === "countered") ? mine : null;

  async function act(
    offer: Offer,
    action: "accept" | "decline" | "counter" | "withdraw",
    value?: number,
  ) {
    setBusy(offer.id + action);
    try {
      await respondToOffer(offer.id, action, value);
      toast.success(
        action === "accept"
          ? "Accepted — sort out viewing and payment in Messages"
          : action === "counter"
            ? "Counter-offer sent"
            : action === "withdraw"
              ? "Offer withdrawn"
              : "Declined",
      );
      setCounterFor(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the offer");
    } finally {
      setBusy(null);
    }
  }

  async function submitOffer(e: React.FormEvent) {
    e.preventDefault();
    const value = Math.round(Number(amount.replace(/[£,\s]/g, "")));
    if (!value || value <= 0) {
      toast.error("Enter an amount in pounds.");
      return;
    }
    setBusy("make");
    try {
      await makeOffer(listing.id, value, note);
      toast.success("Offer sent — we'll let you know when the seller replies");
      setOpen(false);
      setAmount("");
      setNote("");
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your offer");
    } finally {
      setBusy(null);
    }
  }

  if (isOwner) {
    const live = (offers ?? []).filter((o) => o.status !== "withdrawn");
    if (!live.length) return null;
    return (
      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <BadgePoundSterling className="size-5 text-primary" /> Offers ({live.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {live.map((o) => (
            <li key={o.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-extrabold">{formatPrice(o.amount)}</span>
                {asking && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round((Number(o.amount) / asking) * 100)}% of asking
                  </span>
                )}
                <OfferStatus offer={o} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(o.created_at), { addSuffix: true })}
                </span>
              </div>
              {o.message && <p className="mt-1 text-muted-foreground">"{o.message}"</p>}
              {o.status === "countered" && (
                <p className="mt-1 text-xs">You came back with {formatPrice(o.counter_amount)}</p>
              )}
              {o.status === "pending" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act(o, "accept")}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      setCounterFor(o);
                      setCounter(asking ? String(Math.round((Number(o.amount) + asking) / 2)) : "");
                    }}
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-semibold hover:bg-accent"
                  >
                    Counter
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void act(o, "decline")}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
                  >
                    Decline
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <Dialog open={!!counterFor} onOpenChange={(v) => !v && setCounterFor(null)}>
          <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Counter-offer</DialogTitle>
              <DialogDescription>
                They offered {formatPrice(counterFor?.amount)}. What would you take?
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (counterFor)
                  void act(counterFor, "counter", Number(counter.replace(/[£,\s]/g, "")));
              }}
              className="space-y-3"
            >
              <input
                value={counter}
                onChange={(e) => setCounter(e.target.value)}
                inputMode="numeric"
                placeholder="£"
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-lg font-bold"
              />
              <button
                disabled={!!busy}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                Send counter-offer
              </button>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <>
      {openOffer || mine?.status === "accepted" ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">Your offer: {formatPrice(mine!.amount)}</span>
            <OfferStatus offer={mine!} />
          </div>
          {mine!.status === "countered" && (
            <>
              <p className="mt-1">
                The seller came back with <strong>{formatPrice(mine!.counter_amount)}</strong>.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act(mine!, "accept")}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Accept {formatPrice(mine!.counter_amount)}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act(mine!, "decline")}
                  className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent"
                >
                  No thanks
                </button>
              </div>
            </>
          )}
          {mine!.status === "accepted" && (
            <button
              type="button"
              onClick={() =>
                onMessage(
                  `Hi! Great — you accepted ${formatPrice(mine!.final_amount)} for ${listing.title}. When can I come and see it?`,
                )
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            >
              <MessageCircle className="size-3.5" /> Arrange viewing
            </button>
          )}
          {mine!.status === "pending" && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void act(mine!, "withdraw")}
              className="mt-1 text-xs text-muted-foreground underline"
            >
              Withdraw offer
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (userId ? setOpen(true) : onNeedAccount())}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-md border border-input px-4 py-2.5 text-sm font-semibold hover:bg-accent"
        >
          <BadgePoundSterling className="size-4" /> Make an offer
        </button>
      )}
      <Dialog open={open} onOpenChange={(v) => busy !== "make" && setOpen(v)}>
        <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Make an offer</DialogTitle>
            <DialogDescription>
              {asking ? `Asking ${formatPrice(asking)}. ` : ""}The seller can accept, decline or
              come back with a price.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitOffer} className="space-y-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="£"
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-lg font-bold"
            />
            {asking && (
              <div className="flex gap-2">
                {[0.9, 0.95].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAmount(String(Math.round((asking * pct) / 10) * 10))}
                    className="rounded-full border border-input px-3 py-1 text-xs font-medium hover:bg-accent"
                  >
                    {formatPrice(Math.round((asking * pct) / 10) * 10)}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Add a note (optional), e.g. cash ready, can collect this weekend"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              disabled={busy === "make"}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "make" && <Loader2 className="size-4 animate-spin" />}
              Send offer
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Never pay a deposit for something you haven't seen.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Member since, reply time, sales and reviews from buyers. */
export function SellerTrust({ sellerId }: { sellerId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["seller-stats", sellerId],
    queryFn: () => fetchSellerStats(sellerId),
    staleTime: 5 * 60_000,
  });
  const { data: reviews } = useQuery({
    queryKey: ["seller-reviews", sellerId],
    queryFn: () => fetchSellerReviews(sellerId),
    staleTime: 5 * 60_000,
  });
  const [showAll, setShowAll] = useState(false);
  if (!stats) return null;
  const reply = replyTimeLabel(stats);
  const shown = showAll ? reviews : reviews?.slice(0, 2);
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
      <ul className="grid grid-cols-2 gap-2 text-xs">
        <li className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          Member since{" "}
          {new Date(stats.member_since).toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
          })}
        </li>
        {stats.reviews_count > 0 && (
          <li className="flex items-center gap-1.5 font-semibold">
            <Star className="size-3.5 text-amber-500" fill="currentColor" />
            {Number(stats.rating_avg).toFixed(1)} from {stats.reviews_count}{" "}
            {stats.reviews_count === 1 ? "buyer" : "buyers"}
          </li>
        )}
        {stats.sold_listings > 0 && (
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-600" /> {stats.sold_listings} sold
          </li>
        )}
        {reply && (
          <li className="flex items-center gap-1.5">
            <MessageCircle className="size-3.5 text-muted-foreground" /> {reply}
          </li>
        )}
      </ul>
      {shown && shown.length > 0 && (
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id} className="rounded-md bg-muted/50 p-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="flex text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="size-3"
                      fill={i < r.rating ? "currentColor" : "none"}
                    />
                  ))}
                </span>
                <span className="font-medium">{displayUsername(r.reviewer?.username)}</span>
                {r.listing_title && (
                  <span className="truncate text-muted-foreground">· bought {r.listing_title}</span>
                )}
              </div>
              {r.body && <p className="mt-1 text-muted-foreground">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
      {reviews && reviews.length > 2 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs underline">
          {showAll ? "Show fewer reviews" : `See all ${reviews.length} reviews`}
        </button>
      )}
    </div>
  );
}

/** After "Sold through RevMate": who bought it, so they can leave a review. */
export function BuyerPickerDialog({
  listingId,
  open,
  onDone,
}: {
  listingId: string;
  open: boolean;
  onDone: () => void;
}) {
  const { data: people, isLoading } = useQuery({
    queryKey: ["buyer-candidates", listingId],
    queryFn: () => fetchBuyerCandidates(listingId),
    enabled: open,
  });
  const [busy, setBusy] = useState<string | null>(null);
  async function pick(userId: string) {
    setBusy(userId);
    try {
      await setListingBuyer(listingId, userId);
      toast.success("Thanks — we've asked them to leave you a review");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that");
    } finally {
      setBusy(null);
    }
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDone()}>
      <DialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Who bought it?</DialogTitle>
          <DialogDescription>
            Pick the buyer and we'll ask them to review the sale. Reviews help you sell faster next
            time.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {people?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nobody has messaged you about it on RevMate, so there's no one to pick.
          </p>
        )}
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {people?.map((p) => (
            <li key={p.user_id}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void pick(p.user_id)}
                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-accent disabled:opacity-50"
              >
                <Avatar photoUrl={p.avatar_url} fallback={p.username} className="size-9" />
                <span className="flex-1 text-sm font-medium">{displayUsername(p.username)}</span>
                {busy === p.user_id && <Loader2 className="size-4 animate-spin" />}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onDone} className="text-sm text-muted-foreground underline">
          Skip
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function SimilarListings({ listings }: { listings: MarketListing[] }) {
  if (!listings.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">Similar for sale</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        {listings.map((l) => (
          <Link
            key={l.id}
            to="/marketplace/$listingId"
            params={{ listingId: l.id }}
            className="w-40 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="aspect-[4/3] bg-muted">
              {l.photos?.[0] && (
                <img src={l.photos[0]} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </div>
            <p className="px-2 pt-1 text-sm font-extrabold">{formatPrice(l.price)}</p>
            <p className="truncate px-2 pb-2 text-xs text-muted-foreground">{l.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CompareToggle({ listingId }: { listingId: string }) {
  const [ids, setIds] = useCompareList();
  const added = ids.includes(listingId);
  return (
    <button
      type="button"
      onClick={() => {
        if (added) setIds(ids.filter((id) => id !== listingId));
        else if (ids.length >= MAX_COMPARE)
          toast.error(`You can compare up to ${MAX_COMPARE} at once.`);
        else {
          setIds([...ids, listingId]);
          toast.success(ids.length ? "Added to compare" : "Added — pick another to compare");
        }
      }}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold ${added ? "border-primary/40 bg-primary/10 text-primary" : "border-input hover:bg-accent"}`}
    >
      <GitCompareArrows className="size-4" /> {added ? "Comparing" : "Compare"}
    </button>
  );
}
