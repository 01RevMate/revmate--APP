import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MarketListing } from "@/lib/marketplace";
import { BODY_LABELS, FUEL_LABELS } from "@/lib/vehicleSpecs";
import {
  listingMake,
  listingModel,
  matchesCarFilters,
  NO_CAR_FILTERS,
  sameText,
  type CarFilters,
} from "@/lib/carFilters";

const MILEAGE_STEPS = [10000, 20000, 30000, 50000, 75000, 100000, 150000];

/**
 * The "all filters" panel: makes and models come from what's actually for
 * sale (with counts), so nobody picks a filter that returns nothing.
 */
export function CarFiltersSheet({
  open,
  onOpenChange,
  listings,
  value,
  onApply,
  detailed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listings: MarketListing[];
  value: CarFilters;
  onApply: (filters: CarFilters) => void;
  /** Fuel, gearbox, body etc. need 0043_listing_details.sql. */
  detailed: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const set = (patch: Partial<CarFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const cars = useMemo(() => listings.filter((l) => l.type === "car"), [listings]);

  const makes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of cars) {
      const make = listingMake(l);
      if (make) counts.set(make, (counts.get(make) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cars]);
  const models = useMemo(() => {
    if (!draft.make) return [];
    const counts = new Map<string, number>();
    for (const l of cars) {
      if (!sameText(listingMake(l), draft.make)) continue;
      const model = listingModel(l);
      if (model) counts.set(model, (counts.get(model) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [cars, draft.make]);
  const matching = cars.filter((l) => matchesCarFilters(l, draft)).length;
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => thisYear + 1 - i);
  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Filter cars</DialogTitle>
          <DialogDescription>Narrow down the cars for sale on RevMate.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5 text-sm font-medium">
              Make
              <select
                value={draft.make}
                onChange={(e) => set({ make: e.target.value, model: "" })}
                className={`font-normal ${input}`}
              >
                <option value="">Any make</option>
                {makes.map(([make, count]) => (
                  <option key={make} value={make}>
                    {make} ({count})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Model
              <select
                value={draft.model}
                disabled={!draft.make}
                onChange={(e) => set({ model: e.target.value })}
                className={`font-normal disabled:opacity-50 ${input}`}
              >
                <option value="">Any model</option>
                {models.map(([model, count]) => (
                  <option key={model} value={model}>
                    {model} ({count})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Year from
              <select
                value={draft.yearFrom}
                onChange={(e) => set({ yearFrom: e.target.value })}
                className={`font-normal ${input}`}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Year to
              <select
                value={draft.yearTo}
                onChange={(e) => set({ yearTo: e.target.value })}
                className={`font-normal ${input}`}
              >
                <option value="">Any</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 block space-y-1.5 text-sm font-medium">
              Maximum mileage
              <select
                value={draft.maxMileage}
                onChange={(e) => set({ maxMileage: e.target.value })}
                className={`font-normal ${input}`}
              >
                <option value="">Any mileage</option>
                {MILEAGE_STEPS.map((m) => (
                  <option key={m} value={m}>
                    Up to {m.toLocaleString("en-GB")} miles
                  </option>
                ))}
              </select>
            </label>
          </div>

          {detailed && (
            <>
              <ChipGroup
                label="Gearbox"
                value={draft.gearbox}
                options={{ manual: "Manual", automatic: "Automatic" }}
                onChange={(gearbox) => set({ gearbox: gearbox as CarFilters["gearbox"] })}
              />
              <ChipGroup
                label="Fuel"
                value={draft.fuel}
                options={FUEL_LABELS}
                onChange={(fuel) => set({ fuel })}
              />
              <ChipGroup
                label="Body type"
                value={draft.body}
                options={BODY_LABELS}
                onChange={(body) => set({ body })}
              />
              <ChipGroup
                label="Seller"
                value={draft.seller}
                options={{ private: "Private", trade: "Trade" }}
                onChange={(seller) => set({ seller: seller as CarFilters["seller"] })}
              />
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.ulezOnly}
                    onChange={(e) => set({ ulezOnly: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  ULEZ compliant only
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.firstOwnerOnly}
                    onChange={(e) => set({ firstOwnerOnly: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  One previous owner or fewer
                </label>
              </div>
            </>
          )}
        </div>
        <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-2 border-t border-border bg-background p-4">
          <button
            type="button"
            onClick={() => setDraft(NO_CAR_FILTERS)}
            className="rounded-md px-4 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
            className="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Show {matching} {matching === 1 ? "car" : "cars"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChipGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.entries(options).map(([id, text]) => (
          <button
            key={id}
            type="button"
            aria-pressed={value === id}
            onClick={() => onChange(value === id ? "" : id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              value === id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
