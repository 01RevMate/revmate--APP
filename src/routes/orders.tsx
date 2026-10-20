import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Package } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePaidReturn } from "@/hooks/usePaidReturn";
import { formatPence } from "@/lib/money";
import { fetchMyOrders, ORDER_STATUS_LABEL, useBasket } from "@/lib/store";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [{ title: "My orders — RevMate" }, { name: "robots", content: "noindex" }],
  }),
  component: OrdersPage,
});

const STEPS = ["paid", "ordered", "shipped", "delivered"] as const;

function OrdersPage() {
  const { user, loading } = useAuth();
  const { clear } = useBasket();
  // A completed checkout empties the basket. This runs before usePaidReturn,
  // which tidies ?paid=1 out of the address.
  useEffect(() => {
    if (new URL(window.location.href).searchParams.get("paid") === "1") clear();
  }, [clear]);
  usePaidReturn("Thanks for your order! We'll keep you posted here.", [["orders"]]);
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: () => fetchMyOrders(user!.id),
    retry: false,
  });

  if (loading) return <main className="min-h-[60vh]" />;
  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Log in to see your orders.</p>
        <Link
          to="/login"
          search={{ redirect: "/orders" }}
          className="mt-3 inline-block text-primary underline"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-4 pb-12 pt-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <Package className="size-6" /> My orders
      </h1>
      {!isLoading && (orders?.length ?? 0) === 0 && (
        <p className="mt-6 text-sm text-muted-foreground">
          No orders yet.{" "}
          <Link to="/store" className="text-primary underline">
            Browse the store
          </Link>
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {orders?.map((o) => {
          const step = STEPS.indexOf(o.status as (typeof STEPS)[number]);
          return (
            <li key={o.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{ORDER_STATUS_LABEL[o.status]}</p>
                <p className="text-sm font-bold tabular-nums">{formatPence(o.total_pence)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Ordered {new Date(o.created_at).toLocaleDateString("en-GB")} · #{o.id.slice(0, 8)}
              </p>
              {step >= 0 && (
                <div className="mt-3 grid grid-cols-4 gap-1">
                  {STEPS.map((s, i) => (
                    <div key={s}>
                      <div
                        className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {ORDER_STATUS_LABEL[s]}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <ul className="mt-3 space-y-1 text-sm">
                {o.items.map((it) => (
                  <li key={it.product_id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {it.qty} × {it.title}
                    </span>
                    <span className="tabular-nums">{formatPence(it.price_pence * it.qty)}</span>
                  </li>
                ))}
              </ul>
              {o.tracking_number && (
                <p className="mt-3 text-sm">
                  {o.tracking_carrier ? `${o.tracking_carrier}: ` : "Tracking: "}
                  {o.tracking_url ? (
                    <a
                      href={o.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline"
                    >
                      {o.tracking_number} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    o.tracking_number
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-muted-foreground">
        Problem with an order or want to return something? Use Send feedback in the menu or email us
        — you can return most items within 14 days.
      </p>
    </main>
  );
}
