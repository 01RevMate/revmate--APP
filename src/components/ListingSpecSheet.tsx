import { useState } from "react";
import {
  Armchair,
  CalendarDays,
  Car,
  CarFront,
  ChevronRight,
  ClipboardCheck,
  Cog,
  DoorOpen,
  FileText,
  Fuel,
  Gauge,
  Leaf,
  List,
  PaintBucket,
  Settings2,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  BODY_LABELS,
  engineLabel,
  FUEL_LABELS,
  keySpecs,
  TRANSMISSION_LABELS,
  type ListingSpecs,
} from "@/lib/vehicleSpecs";

type Specs = Partial<ListingSpecs> & { mileage?: number | null };

/** The at-a-glance row under the title: year, miles, fuel, gearbox, engine, body. */
export function ListingSpecHighlights({ specs }: { specs: Specs }) {
  const items = [
    { icon: CalendarDays, text: specs.year ? String(specs.year) : null },
    {
      icon: Gauge,
      text: specs.mileage != null ? `${specs.mileage.toLocaleString("en-GB")} mi` : null,
    },
    { icon: Fuel, text: specs.fuel_type ? FUEL_LABELS[specs.fuel_type] : null },
    {
      icon: Cog,
      text: specs.transmission
        ? (TRANSMISSION_LABELS[specs.transmission] ?? "").replace(/ \(.*\)/, "")
        : null,
    },
    { icon: Car, text: engineLabel(specs.engine_size_cc) },
    { icon: Car, text: specs.body_type ? BODY_LABELS[specs.body_type] : null },
  ].filter((item) => item.text);
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
        >
          <item.icon className="size-3.5 text-muted-foreground" />
          {item.text}
        </li>
      ))}
    </ul>
  );
}

const SPEC_ICONS: Record<string, LucideIcon> = {
  Mileage: Gauge,
  Year: CalendarDays,
  Fuel: Fuel,
  Body: CarFront,
  Gearbox: Cog,
  Engine: Settings2,
  Power: Zap,
  Doors: DoorOpen,
  Seats: Armchair,
  Colour: PaintBucket,
  Owners: Users,
  "MOT until": ClipboardCheck,
  History: Wrench,
  ULEZ: Leaf,
  "V5C logbook": FileText,
  Modified: Sparkles,
  Seller: Store,
};
// The facts buyers look for first; the rest sit behind "View all details".
const OVERVIEW_ORDER = ["Mileage", "Year", "Fuel", "Body", "Gearbox", "Engine", "Doors", "Seats"];

/** "Overview" card (icon, label, value in two columns) plus a buyer's checklist. */
export function ListingSpecSheet({ specs }: { specs: Specs }) {
  const [showAll, setShowAll] = useState(false);
  const all = keySpecs(specs);
  const rank = (label: string) => {
    const i = OVERVIEW_ORDER.indexOf(label);
    return i === -1 ? OVERVIEW_ORDER.length : i;
  };
  const ordered = [...all].sort((a, b) => rank(a.label) - rank(b.label));
  const overview = ordered.filter((row) => OVERVIEW_ORDER.includes(row.label));
  const primary = overview.length >= 4 ? overview : ordered.slice(0, 8);
  const extra = ordered.filter((row) => !primary.includes(row));
  const shown = showAll ? [...primary, ...extra] : primary;
  return (
    <section className="mt-6 space-y-4">
      {all.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Overview</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
            {shown.map((row) => {
              const Icon = SPEC_ICONS[row.label] ?? Car;
              return (
                <div key={row.label} className="flex items-start gap-3">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0">
                    <dt className="text-sm font-semibold">{row.label}</dt>
                    <dd className="text-sm text-muted-foreground">{row.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
          {extra.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-5 flex w-full items-center gap-3 border-t border-border pt-4 text-sm font-semibold"
            >
              <List className="size-5 text-muted-foreground" strokeWidth={1.75} />
              {showAll ? "Show less" : `View all details (${extra.length} more)`}
              <ChevronRight
                className={`ml-auto size-5 transition-transform ${showAll ? "-rotate-90" : ""}`}
              />
            </button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Details are supplied by the seller and haven't been checked by RevMate.
          </p>
        </div>
      )}
      <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <p className="flex items-center gap-1.5 font-semibold">
          <ShieldCheck className="size-4 text-primary" /> Before you buy
        </p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>
            • Check the{" "}
            <a
              href="https://www.gov.uk/check-mot-history"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline"
            >
              MOT history on GOV.UK
            </a>{" "}
            (free) and get a history check for finance, theft and write-offs.
          </li>
          <li>• See the car and the V5C logbook at the seller's address before paying anything.</li>
          <li>• Never send a deposit for a car you haven't seen.</li>
        </ul>
      </div>
    </section>
  );
}
