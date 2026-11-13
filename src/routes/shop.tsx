import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { SHOP_LIVE, SHOP_URL } from "@/lib/shop";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Coming soon — RevMate" },
      {
        name: "description",
        content:
          "The RevMate shop is landing soon. A Christmas gift shop for car people: funny car tees, sweatshirts and mugs. Opening late November.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ShopPage,
});

const ITEMS = ["Tees", "Sweatshirts", "Mugs"] as const;

function ShopPage() {
  useEffect(() => {
    if (SHOP_LIVE) window.location.assign(SHOP_URL);
  }, []);

  if (SHOP_LIVE) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Opening the RevMate shop…</p>
        <a href={SHOP_URL} className="mt-4 text-sm font-medium text-primary underline">
          Continue to the shop
        </a>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.2_0_0/0.07),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,oklch(1_0_0/0.07),transparent_70%)]"
      />
      <div className="relative w-full">
        <BrandLogo className="mx-auto h-16 w-32" />
        <p className="mt-8 inline-flex items-center rounded-full border border-red-600/30 bg-red-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-500">
          Opening late November
        </p>
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Coming soon
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          The RevMate shop is landing soon — a Christmas gift shop for car people. Funny car tees,
          sweatshirts and mugs, ready in time for Christmas.
        </p>
        <ul className="mt-8 grid grid-cols-3 gap-2">
          {ITEMS.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-border bg-card px-2 py-3 text-sm font-medium text-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
        <Link
          to="/"
          className="mt-10 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to the community
        </Link>
      </div>
    </main>
  );
}
