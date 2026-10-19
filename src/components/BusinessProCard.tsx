import { useState } from "react";
import { BadgeCheck, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  formatPence,
  isLive,
  openBillingPortal,
  startCheckout,
  useMyBilling,
  usePaymentsEnabled,
  useProducts,
} from "@/lib/money";

/** Owner-only: Business Pro puts the business first in Find a mechanic. */
export function BusinessProCard({ businessId }: { businessId: string }) {
  const enabled = usePaymentsEnabled();
  const product = useProducts().find((p) => p.kind === "business_pro" && p.active);
  const billing = useMyBilling();
  const [busy, setBusy] = useState(false);
  const current = billing?.subscriptions.find(
    (s) => s.target_id === businessId && s.product_code === product?.code && isLive(s),
  );
  if (!product || (!enabled && !current)) return null;

  async function go() {
    setBusy(true);
    try {
      if (current) await openBillingPortal(`/businesses/${businessId}`);
      else await startCheckout(product!.code, `/businesses/${businessId}`, businessId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open payments");
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <BadgeCheck className="size-4 text-emerald-600" />
        {current ? "You're on Business Pro" : "Get more customers with Business Pro"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {current
          ? current.cancel_at_period_end && current.current_period_end
            ? `Ends ${new Date(current.current_period_end).toLocaleDateString("en-GB")}.`
            : "Shown first in Find a mechanic with a Pro badge."
          : `Shown first in Find a mechanic with a Pro badge. ${formatPence(product.price_pence)} a month, cancel any time.`}
      </p>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {current ? <Settings2 className="size-4" /> : null}
        {busy ? "Opening…" : current ? "Manage" : "Go Pro"}
      </button>
    </div>
  );
}
