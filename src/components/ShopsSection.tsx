import { Link } from "@tanstack/react-router";
import { Plus, ShoppingBag, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SHOP_CATEGORIES, useShopCount } from "@/lib/shops";
import { useStoreOpen } from "@/lib/store";

/**
 * Essentials → Shop: one row of categories into the Shops directory. Shown
 * once there's at least one live shop; before that, members just see a small
 * "list your shop" invite so the page never shows an empty section.
 */
export function ShopsSection() {
  const storeOpen = useStoreOpen();
  return (
    <>
      {storeOpen && <StoreBanner />}
      <IndependentShops />
    </>
  );
}

/** The RevMate Store: things RevMate sells and delivers. */
function StoreBanner() {
  return (
    <Link
      to="/store"
      className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-700 p-4 text-white"
    >
      <ShoppingBag className="size-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">RevMate Store</span>
        <span className="flex items-center gap-1 text-sm text-white/80">
          <Truck className="size-3.5" /> Car care, parts & accessories delivered
        </span>
      </span>
    </Link>
  );
}

function IndependentShops() {
  const count = useShopCount();
  const { user } = useAuth();
  if (count === null) return null;
  if (count === 0) {
    if (!user) return null;
    return (
      <Link
        to="/shops/new"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-3 text-sm"
      >
        <Plus className="size-5 text-primary" />
        <span>
          <span className="font-semibold">Make or sell car products?</span>{" "}
          <span className="text-muted-foreground">List your shop on RevMate free.</span>
        </span>
      </Link>
    );
  }
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold">Independent shops</h2>
        <Link to="/shops" className="text-sm font-medium text-primary">
          All shops
        </Link>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
        {SHOP_CATEGORIES.map((c) => (
          <Link
            key={c.id}
            to="/shops"
            search={{ category: c.id }}
            className="flex w-24 shrink-0 flex-col items-center gap-1 rounded-2xl bg-card p-3 text-center shadow-sm"
          >
            <span className="text-2xl" aria-hidden>
              {c.emoji}
            </span>
            <span className="text-xs font-medium leading-tight">{c.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
