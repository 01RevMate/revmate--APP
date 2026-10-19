import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, Check, Gem } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { usePaidReturn } from "@/hooks/usePaidReturn";
import { useFoundingNumber } from "@/lib/launch";
import {
  formatPence,
  isLive,
  openBillingPortal,
  startCheckout,
  useMyBilling,
  usePaymentsEnabled,
  useProducts,
} from "@/lib/money";

export const Route = createFileRoute("/plus")({
  head: () => ({
    meta: [
      { title: "RevMate Plus" },
      { name: "description", content: "Support RevMate and go ad-free with RevMate Plus." },
    ],
  }),
  component: PlusPage,
});

// Only list perks that exist. Everything social stays free for everyone.
const PERKS = [
  "No ads or deals anywhere in the app",
  "A Plus badge on your profile",
  "Helps keep RevMate independent and free for every member",
  "Cancel any time from Settings",
];

function PlusPage() {
  const { user } = useAuth();
  const enabled = usePaymentsEnabled();
  const product = useProducts().find((p) => p.kind === "plus" && p.active);
  const billing = useMyBilling();
  const founding = useFoundingNumber(user?.id);
  const [busy, setBusy] = useState(false);
  usePaidReturn("Welcome to RevMate Plus. Thank you!", [["plus-member"]]);

  const current = billing?.subscriptions.find((s) => s.product_code === product?.code && isLive(s));
  const price =
    founding && product?.founding_price_pence ? product.founding_price_pence : product?.price_pence;

  async function go() {
    setBusy(true);
    try {
      if (current) await openBillingPortal("/plus");
      else await startCheckout(product!.code, "/plus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open payments");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <div className="rounded-3xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-6 text-white">
        <Gem className="size-9" />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">RevMate Plus</h1>
        <p className="mt-1 text-white/90">
          RevMate is free and always will be. Plus is for members who want to back it.
        </p>
        {product && price !== undefined && (
          <p className="mt-4 text-2xl font-bold">
            {formatPence(price)}
            <span className="text-base font-medium text-white/80"> a month</span>
          </p>
        )}
        {founding && product?.founding_price_pence ? (
          <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
            <Award className="size-3.5" /> Founding member price (normally{" "}
            {formatPence(product.price_pence)})
          </p>
        ) : null}
      </div>

      <ul className="mt-6 space-y-3">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {!product || (!enabled && !current) ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Plus isn't open yet. Check back soon.
          </p>
        ) : !user ? (
          <Link
            to="/login"
            className="flex min-h-12 items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Log in to join Plus
          </Link>
        ) : (
          <>
            {current && (
              <p className="mb-3 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                You're a Plus member
                {current.cancel_at_period_end && current.current_period_end
                  ? ` until ${new Date(current.current_period_end).toLocaleDateString("en-GB")}`
                  : ""}
                . Thank you!
              </p>
            )}
            <button
              type="button"
              onClick={go}
              disabled={busy}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Opening…" : current ? "Manage Plus" : "Join Plus"}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Secure payment by Stripe. Renews monthly until you cancel. See our{" "}
              <Link to="/legal/terms" className="underline">
                terms
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
