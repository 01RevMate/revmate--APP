import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Gavel, MessageCircle, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthModal } from "@/hooks/useAuthModal";
import {
  auctionEnded,
  fetchBids,
  fetchCounterparty,
  fetchMyAuctionStatus,
  minNextBid,
  placeBid,
  setReserve,
  settleDueAuctions,
  timeLeft,
  type AuctionFields,
} from "@/lib/auctions";

const money = (n: number) => `£${n.toLocaleString("en-GB")}`;

/** Bidding, countdown and results for an auction listing. */
export function AuctionPanel({
  listing,
  isOwner,
}: {
  listing: AuctionFields & { id: string; user_id: string; status: string };
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const { open: openAuthModal } = useAuthModal();
  const queryClient = useQueryClient();
  const ended = auctionEnded(listing);
  const [now, setNow] = useState(() => Date.now());
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showBids, setShowBids] = useState(false);
  const next = minNextBid(listing);
  const current = listing.current_bid != null ? Number(listing.current_bid) : null;

  // Live countdown; refresh the listing now and then so new bids show up.
  useEffect(() => {
    if (ended) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(
      () => void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] }),
      15000,
    );
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [ended, listing.id, queryClient]);

  useEffect(() => {
    if (ended && !listing.auction_settled_at) settleDueAuctions();
  }, [ended, listing.auction_settled_at]);

  const { data: myStatus } = useQuery({
    queryKey: ["auction", "me", listing.id, listing.bid_count, listing.auction_settled_at],
    enabled: !!user && !isOwner,
    queryFn: () => fetchMyAuctionStatus(listing.id),
  });
  const { data: bids } = useQuery({
    queryKey: ["auction", "bids", listing.id, listing.bid_count],
    enabled: showBids,
    queryFn: () => fetchBids(listing.id),
  });
  const { data: counterparty } = useQuery({
    queryKey: ["auction", "counterparty", listing.id, listing.auction_settled_at],
    enabled: !!user && !!listing.auction_settled_at && (isOwner || myStatus === "won"),
    queryFn: () => fetchCounterparty(listing.id),
  });

  async function bid() {
    const value = Math.round(Number(amount || next));
    if (!(value >= next)) {
      toast.error(`Bid at least ${money(next)}`);
      return;
    }
    setBusy(true);
    try {
      const res = await placeBid(listing.id, value);
      toast.success(
        res.extended
          ? "You're the top bidder! The auction was extended by 2 minutes."
          : "You're the top bidder!",
      );
      setAmount("");
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ["listing", listing.id] });
      void queryClient.invalidateQueries({ queryKey: ["auction"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't place your bid");
    } finally {
      setBusy(false);
    }
  }

  const reserveText = !listing.has_reserve
    ? "No reserve"
    : listing.reserve_met
      ? "Reserve met"
      : "Reserve not met yet";

  return (
    <section className="mt-4 rounded-2xl border-2 border-primary/30 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Gavel className="size-4" /> Auction
        </p>
        {!ended && listing.auction_ends_at && (
          <p className="flex items-center gap-1 text-sm font-semibold tabular-nums">
            <Clock className="size-4" /> {timeLeft(listing.auction_ends_at, now)} left
          </p>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-extrabold tabular-nums">
            {money(current ?? Number(listing.start_price ?? 0))}
          </p>
          <p className="text-sm text-muted-foreground">
            {current === null ? "Starting price" : "Current bid"} · {listing.bid_count ?? 0} bid
            {listing.bid_count === 1 ? "" : "s"} · {reserveText}
          </p>
        </div>
        {myStatus === "winning" && !ended && (
          <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
            You're winning
          </span>
        )}
        {myStatus === "outbid" && !ended && (
          <span className="rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-black">
            You've been outbid
          </span>
        )}
      </div>

      {ended ? (
        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
          {listing.bid_count && listing.reserve_met ? (
            <p className="flex items-center gap-1.5 font-semibold">
              <Trophy className="size-4 text-amber-500" />
              {myStatus === "won"
                ? `You won this for ${money(current ?? 0)}!`
                : `Ended at ${money(current ?? 0)}`}
            </p>
          ) : listing.bid_count ? (
            <p className="font-semibold">Ended without reaching the reserve.</p>
          ) : (
            <p className="font-semibold">Ended with no bids.</p>
          )}
          {counterparty && (
            <Link
              to="/messages/$username"
              params={{ username: counterparty }}
              className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
            >
              <MessageCircle className="size-4" />
              Message {isOwner ? "the winner" : "the seller"}
            </Link>
          )}
        </div>
      ) : isOwner ? (
        <OwnerReserve listingId={listing.id} canChange={(listing.bid_count ?? 0) === 0} />
      ) : listing.status === "active" ? (
        <div className="mt-3">
          {!confirming ? (
            <div className="flex gap-2">
              <input
                type="number"
                min={next}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`${money(next)} or more`}
                className="min-h-12 flex-1 rounded-xl border border-input bg-background px-3 text-base"
                aria-label="Your bid in pounds"
              />
              <button
                type="button"
                onClick={() =>
                  user ? setConfirming(true) : openAuthModal("Create a free account to bid.")
                }
                className="min-h-12 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
              >
                Bid
              </button>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="font-semibold">Bid {money(Math.round(Number(amount || next)))}?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                A bid means you're committed to buy if you win and it's as described. You and the
                seller arrange viewing, payment and collection in Messages. Bids can't be withdrawn.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-11 flex-1 rounded-xl border border-input font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void bid()}
                  className="min-h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Bidding…" : "Confirm bid"}
                </button>
              </div>
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Next bid at least {money(next)}. A bid in the last 2 minutes adds 2 minutes.
          </p>
        </div>
      ) : null}

      {(listing.bid_count ?? 0) > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowBids((v) => !v)}
            className="text-sm font-medium text-primary"
          >
            {showBids ? "Hide bid history" : `Bid history (${listing.bid_count})`}
          </button>
          {showBids && (
            <ul className="mt-2 divide-y divide-border text-sm">
              {bids?.map((b, i) => (
                <li key={`${b.created_at}-${i}`} className="flex justify-between py-1.5">
                  <span>
                    {b.is_me ? "You" : b.bidder_label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(b.created_at).toLocaleString("en-GB", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{money(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function OwnerReserve({ listingId, canChange }: { listingId: string; canChange: boolean }) {
  const queryClient = useQueryClient();
  const [reserve, setReserveValue] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canChange) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Your auction has bids, so it runs until it ends. We'll tell you the result.
      </p>
    );
  }
  return (
    <div className="mt-3 flex gap-2">
      <input
        type="number"
        min="1"
        value={reserve}
        onChange={(e) => setReserveValue(e.target.value)}
        placeholder="Secret reserve £ (blank = none)"
        className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
      />
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await setReserve(listingId, reserve.trim() ? Number(reserve) : null);
            toast.success(reserve.trim() ? "Reserve saved" : "Reserve removed");
            void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't save");
          } finally {
            setBusy(false);
          }
        }}
        className="min-h-11 rounded-xl border border-input px-4 text-sm font-semibold"
      >
        Save
      </button>
    </div>
  );
}
