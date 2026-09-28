import { CalendarDays, Cog, Fuel, Gauge, ShieldCheck, Car } from "lucide-react";
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

/** Full spec sheet plus a short buyer's checklist. */
export function ListingSpecSheet({ specs }: { specs: Specs }) {
  const rows = keySpecs(specs);
  return (
    <section className="mt-6 space-y-4">
      {rows.length > 1 && (
        <div>
          <h2 className="text-base font-semibold">Vehicle details</h2>
          <dl className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-border text-sm sm:grid-cols-3">
            {rows.map((row) => (
              <div key={row.label} className="border-b border-r border-border p-3 last:border-r-0">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1.5 text-xs text-muted-foreground">
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
