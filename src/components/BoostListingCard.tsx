import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { toast } from "sonner";
import { formatPence, startCheckout, usePaymentsEnabled, useProducts } from "@/lib/money";

/** Owner-only: pay to feature a live listing at the top of Buy & Sell. */
export function BoostListingCard({ listingId, status }: { listingId: string; status: string }) {
  const enabled = usePaymentsEnabled();
  const options = useProducts().filter((p) => p.kind === "listing_feature" && p.active);
  const [busy, setBusy] = useState<string | null>(null);
  if (!enabled || status !== "active" || options.length === 0) return null;

  async function buy(code: string) {
    setBusy(code);
    try {
      await startCheckout(code, `/marketplace/${listingId}`, listingId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open the payment page");
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Rocket className="size-4 text-amber-600" /> Sell it faster
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Featured adverts sit at the top of Buy &amp; Sell with a gold label.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map((p) => (
          <button
            key={p.code}
            type="button"
            disabled={!!busy}
            onClick={() => buy(p.code)}
            className="min-h-11 rounded-xl bg-background px-3 py-2 text-sm font-semibold shadow-sm hover:bg-muted disabled:opacity-60"
          >
            {busy === p.code
              ? "Opening…"
              : `${p.feature_days} days · ${formatPence(p.price_pence)}`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Secure payment by Stripe. The feature starts as soon as you pay, so it can't be cancelled
        once it's begun (
        <Link to="/legal/terms" className="underline">
          terms
        </Link>
        ).
      </p>
    </div>
  );
}
