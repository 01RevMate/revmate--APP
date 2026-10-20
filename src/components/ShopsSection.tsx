import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SHOP_CATEGORIES, useShopCount } from "@/lib/shops";

/**
 * Essentials → Shop: one row of categories into the Shops directory. Shown
 * once there's at least one live shop; before that, members just see a small
 * "list your shop" invite so the page never shows an empty section.
 */
export function ShopsSection() {
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
        <h2 className="text-lg font-bold">Shop</h2>
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
