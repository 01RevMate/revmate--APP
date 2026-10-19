import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gem } from "lucide-react";
import { toast } from "sonner";
import {
  formatPence,
  isLive,
  openBillingPortal,
  useMyBilling,
  usePaymentsEnabled,
  useProducts,
} from "@/lib/money";

/** Settings: Plus status, receipts and the Stripe billing page. */
export function BillingSettings() {
  const enabled = usePaymentsEnabled();
  const billing = useMyBilling();
  const products = useProducts();
  const [busy, setBusy] = useState(false);
  const hasHistory = !!billing && (billing.payments.length > 0 || billing.subscriptions.length > 0);
  if (!enabled && !hasHistory) return null;

  const name = (code: string) => products.find((p) => p.code === code)?.name ?? code;
  const plusCodes = products.filter((p) => p.kind === "plus").map((p) => p.code);
  const plus = billing?.subscriptions.find((s) => plusCodes.includes(s.product_code) && isLive(s));

  async function manage() {
    setBusy(true);
    try {
      await openBillingPortal("/settings");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open billing");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link
        to="/plus"
        className="flex items-center gap-3 rounded-xl border border-violet-500/40 bg-violet-500/10 p-3 hover:bg-violet-500/15"
      >
        <Gem className="size-6 shrink-0 text-violet-600 dark:text-violet-300" />
        <div className="min-w-0">
          <p className="font-semibold">{plus ? "You're a Plus member" : "RevMate Plus"}</p>
          <p className="text-sm text-muted-foreground">
            {plus
              ? plus.cancel_at_period_end && plus.current_period_end
                ? `Ends ${new Date(plus.current_period_end).toLocaleDateString("en-GB")}`
                : "Thanks for backing RevMate."
              : "Optional: go ad-free and support the app."}
          </p>
        </div>
      </Link>

      {hasHistory && (
        <>
          <button
            type="button"
            onClick={manage}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-xl border border-input px-4 text-sm font-semibold disabled:opacity-60"
          >
            {busy ? "Opening…" : "Manage billing, cards and receipts"}
          </button>
          {billing!.payments.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {billing!.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate">
                    {name(p.product_code)}
                    <span className="block text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("en-GB")}
                      {p.status === "refunded" ? " · refunded" : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatPence(p.amount_pence)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
