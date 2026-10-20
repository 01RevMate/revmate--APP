import { Gavel, Tag } from "lucide-react";
import { AUCTION_DAYS, type AuctionChoice } from "@/lib/auctions";

/** Sell form: fixed price or auction (with length and optional reserve). */
export function AuctionChoiceFields({
  value,
  onChange,
}: {
  value: AuctionChoice;
  onChange: (next: AuctionChoice) => void;
}) {
  const btn = (active: boolean) =>
    `flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${active ? "border-primary bg-primary text-primary-foreground" : "border-input"}`;
  return (
    <div className="space-y-3">
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label="How do you want to sell?"
      >
        <button
          type="button"
          role="radio"
          aria-checked={value.format === "fixed"}
          onClick={() => onChange({ ...value, format: "fixed" })}
          className={btn(value.format === "fixed")}
        >
          <Tag className="size-4" /> Fixed price
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={value.format === "auction"}
          onClick={() => onChange({ ...value, format: "auction" })}
          className={btn(value.format === "auction")}
        >
          <Gavel className="size-4" /> Auction
        </button>
      </div>
      {value.format === "auction" && (
        <div className="space-y-3 rounded-xl bg-muted/50 p-3">
          <div>
            <p className="text-sm font-medium">How long?</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {AUCTION_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ ...value, days: d })}
                  className={`rounded-full border px-3 py-1.5 text-sm ${value.days === d ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"}`}
                >
                  {d} day{d === 1 ? "" : "s"}
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-medium">
            Reserve price £ (optional, kept secret)
            <input
              type="number"
              min="1"
              value={value.reserve}
              onChange={(e) => onChange({ ...value, reserve: e.target.value })}
              placeholder="The lowest you'll accept"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Bidders only see whether the reserve has been met. Once someone bids you can't change
            the price or end it early. The winner and you arrange payment and collection in
            Messages.
          </p>
        </div>
      )}
    </div>
  );
}
