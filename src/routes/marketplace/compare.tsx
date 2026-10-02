import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { PriceGuideBadge } from "@/components/PriceGuideBadge";
import { fetchMarketListings, formatPrice, type MarketListing } from "@/lib/marketplace";
import { keySpecs } from "@/lib/vehicleSpecs";
import { priceGuide, useCompareList } from "@/lib/marketDeals";

export const Route = createFileRoute("/marketplace/compare")({
  head: () => ({
    meta: [{ title: "Compare cars — RevMate" }, { name: "robots", content: "noindex, follow" }],
  }),
  component: ComparePage,
});

const ROWS = [
  "Year",
  "Mileage",
  "Fuel",
  "Gearbox",
  "Engine",
  "Power",
  "Body",
  "Owners",
  "MOT until",
  "History",
  "ULEZ",
  "Colour",
  "Modified",
];

function extraRows(l: MarketListing): Record<string, string | null> {
  return {
    MPG: l.mpg ? `${Number(l.mpg)} mpg` : null,
    "CO₂": l.co2_gkm != null ? `${l.co2_gkm} g/km` : null,
    Insurance: l.insurance_group ? `Group ${l.insurance_group}` : null,
    Area: l.location_district ?? l.location_area ?? null,
  };
}

function ComparePage() {
  const [ids, setIds] = useCompareList();
  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", "market"],
    queryFn: fetchMarketListings,
  });
  const picked = ids
    .map((id) => listings?.find((l) => l.id === id))
    .filter((l): l is MarketListing => !!l);
  const specs = picked.map((l) => Object.fromEntries(keySpecs(l).map((r) => [r.label, r.value])));
  const extras = picked.map(extraRows);
  const rows = [
    ...ROWS.filter((row) => specs.some((s) => s[row])),
    ...Object.keys(extras[0] ?? {}).filter((row) => extras.some((e) => e[row])),
  ];
  const value = (i: number, row: string) => specs[i]?.[row] ?? extras[i]?.[row] ?? "—";
  // Highlight the best value on the rows where "best" is obvious.
  const best = (row: string) => {
    if (row !== "Mileage" && row !== "Year" && row !== "Power") return -1;
    const nums = picked.map((l) =>
      row === "Mileage"
        ? (l.mileage ?? Infinity)
        : row === "Year"
          ? -(l.year ?? 0)
          : -(l.power_bhp ?? 0),
    );
    const min = Math.min(...nums);
    return Number.isFinite(min) && nums.filter((n) => n === min).length === 1
      ? nums.indexOf(min)
      : -1;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to Buy & Sell
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Compare cars</h1>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && picked.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing to compare yet. Open a car and tap "Compare" — you can pick up to three.
        </p>
      )}
      {picked.length > 0 && (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2">
          {/* A grid, not a table: every column is the same width and every photo
              the same shape, whatever size the original photos are. */}
          <div
            className="grid gap-x-2 text-sm"
            style={{
              gridTemplateColumns: `72px repeat(${picked.length}, minmax(132px, 280px))`,
              minWidth: 72 + picked.length * 140,
            }}
          >
            <div />
            {picked.map((l) => {
              const guide = priceGuide(l, listings ?? []);
              return (
                <div
                  key={l.id}
                  className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-card"
                >
                  <button
                    type="button"
                    aria-label={`Remove ${l.title}`}
                    onClick={() => setIds(ids.filter((id) => id !== l.id))}
                    className="absolute right-1 top-1 z-10 rounded-full bg-black/55 p-1 text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                  <Link to="/marketplace/$listingId" params={{ listingId: l.id }} className="block">
                    {l.photos?.[0] ? (
                      <img
                        src={l.photos[0]}
                        alt=""
                        className="block aspect-[4/3] h-auto w-full bg-muted object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/3] w-full bg-muted" />
                    )}
                    <div className="p-2">
                      <p className="text-base font-extrabold sm:text-lg">{formatPrice(l.price)}</p>
                      <p className="line-clamp-2 text-xs font-medium">{l.title}</p>
                      {guide && <PriceGuideBadge guide={guide} compact />}
                    </div>
                  </Link>
                </div>
              );
            })}
            {rows.map((row) => {
              const winner = best(row);
              return (
                <div key={row} className="contents">
                  <div className="border-b border-border py-2 text-xs font-semibold text-muted-foreground">
                    {row}
                  </div>
                  {picked.map((l, i) => (
                    <div
                      key={l.id}
                      className={`min-w-0 break-words border-b border-border py-2 ${winner === i ? "font-bold text-emerald-700 dark:text-emerald-400" : ""}`}
                    >
                      {value(i, row)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          {picked.length < 2 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Add another car to see them side by side.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
