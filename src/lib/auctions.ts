import { useQuery } from "@tanstack/react-query";
import { looseDb as db } from "@/lib/looseDb";

// Auctions on Buy & Sell (0068). Bids, the hidden reserve and settling all
// happen in the database; this is the app's side of it.

export type AuctionFields = {
  sale_format?: "fixed" | "auction";
  auction_ends_at?: string | null;
  start_price?: number | null;
  current_bid?: number | null;
  bid_count?: number;
  has_reserve?: boolean;
  reserve_met?: boolean;
  auction_settled_at?: string | null;
};

export type AuctionChoice = { format: "fixed" | "auction"; days: number; reserve: string };

export const AUCTION_DAYS = [1, 3, 5, 7, 10] as const;

/** True once the auctions SQL has run. */
export function useAuctionsFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "auctions"],
    queryFn: async () => !(await db.from("listings").select("sale_format").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

export function isAuction(l: object): l is AuctionFields & { sale_format: "auction" } {
  return (l as AuctionFields).sale_format === "auction";
}

/** Same steps as private.bid_increment in 0068. */
export function bidIncrement(current: number) {
  if (current < 100) return 1;
  if (current < 1000) return 10;
  if (current < 5000) return 50;
  if (current < 20000) return 100;
  return 250;
}

export function minNextBid(l: AuctionFields): number {
  const current =
    l.current_bid === null || l.current_bid === undefined ? null : Number(l.current_bid);
  return current === null ? Number(l.start_price ?? 1) : current + bidIncrement(current);
}

export function auctionEnded(l: AuctionFields) {
  return !!l.auction_ends_at && new Date(l.auction_ends_at).getTime() <= Date.now();
}

/** "2d 4h", "3h 12m", "45s" */
export function timeLeft(endsAt: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Columns to add when creating an auction listing. */
export function auctionInsert(choice: AuctionChoice, startPrice: number) {
  return {
    sale_format: "auction",
    start_price: startPrice,
    auction_ends_at: new Date(Date.now() + choice.days * 86400000).toISOString(),
  };
}

export async function setReserve(listingId: string, reserve: number | null) {
  const { error } = await db.rpc("set_auction_reserve", { target_listing: listingId, reserve });
  if (error) throw new Error(error.message);
}

export async function placeBid(listingId: string, amount: number) {
  const { data, error } = await db.rpc("place_bid", {
    target_listing: listingId,
    bid_amount: amount,
  });
  if (error) throw new Error(error.message);
  return data as { current_bid: number; ends_at: string; extended: boolean; reserve_met: boolean };
}

export type BidRow = {
  amount: number;
  created_at: string;
  bidder_label: string;
  is_me: boolean | null;
};

export async function fetchBids(listingId: string): Promise<BidRow[]> {
  const { data, error } = await db.rpc("auction_bids", { target_listing: listingId });
  if (error) throw new Error(error.message);
  return (data as BidRow[]).map((b) => ({ ...b, amount: Number(b.amount) }));
}

export async function fetchMyAuctionStatus(listingId: string) {
  const { data } = await db.rpc("my_auction_status", { target_listing: listingId });
  return (data as "none" | "winning" | "outbid" | "won" | null) ?? "none";
}

export async function fetchCounterparty(listingId: string): Promise<string | null> {
  const { data } = await db.rpc("auction_counterparty", { target_listing: listingId });
  return (data as string | null) ?? null;
}

let lastSettle = 0;
/** Closes any finished auctions. Cheap; called now and then by the app. */
export function settleDueAuctions() {
  if (Date.now() - lastSettle < 60_000) return;
  lastSettle = Date.now();
  // Supabase only sends the request once something waits on it.
  void db.rpc("settle_due_auctions").then(() => undefined);
}
