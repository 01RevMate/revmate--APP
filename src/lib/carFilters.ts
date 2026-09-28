import type { MarketListing } from "@/lib/marketplace";
import { BODY_LABELS, FUEL_LABELS, isAutomatic } from "@/lib/vehicleSpecs";

// Buy & Sell car filters (used by the marketplace grid and CarFiltersSheet).

export type CarFilters = {
  make: string;
  model: string;
  yearFrom: string;
  yearTo: string;
  maxMileage: string;
  fuel: string;
  gearbox: "" | "manual" | "automatic";
  body: string;
  seller: "" | "private" | "trade";
  ulezOnly: boolean;
  firstOwnerOnly: boolean;
};

export const NO_CAR_FILTERS: CarFilters = {
  make: "",
  model: "",
  yearFrom: "",
  yearTo: "",
  maxMileage: "",
  fuel: "",
  gearbox: "",
  body: "",
  seller: "",
  ulezOnly: false,
  firstOwnerOnly: false,
};

export const listingMake = (l: MarketListing) =>
  l.make ?? l.garage_cars?.make ?? l.cars?.make ?? null;
export const listingModel = (l: MarketListing) =>
  l.model ?? l.garage_cars?.model ?? l.cars?.model ?? null;
export const listingYear = (l: MarketListing) => l.year ?? l.garage_cars?.year ?? null;

export const sameText = (a: string | null, b: string) => !!a && a.toLowerCase() === b.toLowerCase();

export function matchesCarFilters(listing: MarketListing, f: CarFilters): boolean {
  const anyCarFilter = activeFilterCount(f) > 0;
  if (!anyCarFilter) return true;
  // Vehicle filters only make sense for cars.
  if (listing.type !== "car") return false;
  if (f.make && !sameText(listingMake(listing), f.make)) return false;
  if (f.model && !sameText(listingModel(listing), f.model)) return false;
  const year = listingYear(listing);
  if (f.yearFrom && (!year || year < Number(f.yearFrom))) return false;
  if (f.yearTo && (!year || year > Number(f.yearTo))) return false;
  if (f.maxMileage && (listing.mileage == null || listing.mileage > Number(f.maxMileage)))
    return false;
  if (f.fuel && listing.fuel_type !== f.fuel) return false;
  if (f.gearbox === "manual" && listing.transmission !== "manual") return false;
  if (f.gearbox === "automatic" && !isAutomatic(listing.transmission)) return false;
  if (f.body && listing.body_type !== f.body) return false;
  if (f.seller && (listing.seller_type ?? "private") !== f.seller) return false;
  if (f.ulezOnly && listing.ulez_compliant !== true) return false;
  if (f.firstOwnerOnly && !(listing.previous_owners != null && listing.previous_owners <= 1))
    return false;
  return true;
}

export function activeFilterCount(f: CarFilters): number {
  return Object.entries(f).filter(([, v]) => v !== "" && v !== false).length;
}

/** Short labels for the removable chips under the search bar. */
export function filterChips(f: CarFilters): { key: keyof CarFilters; label: string }[] {
  const chips: { key: keyof CarFilters; label: string }[] = [];
  if (f.make) chips.push({ key: "make", label: f.make });
  if (f.model) chips.push({ key: "model", label: f.model });
  if (f.yearFrom) chips.push({ key: "yearFrom", label: `From ${f.yearFrom}` });
  if (f.yearTo) chips.push({ key: "yearTo", label: `Up to ${f.yearTo}` });
  if (f.maxMileage)
    chips.push({
      key: "maxMileage",
      label: `≤ ${Number(f.maxMileage).toLocaleString("en-GB")} mi`,
    });
  if (f.fuel) chips.push({ key: "fuel", label: FUEL_LABELS[f.fuel] ?? f.fuel });
  if (f.gearbox)
    chips.push({ key: "gearbox", label: f.gearbox === "manual" ? "Manual" : "Automatic" });
  if (f.body) chips.push({ key: "body", label: BODY_LABELS[f.body] ?? f.body });
  if (f.seller) chips.push({ key: "seller", label: f.seller === "trade" ? "Trade" : "Private" });
  if (f.ulezOnly) chips.push({ key: "ulezOnly", label: "ULEZ" });
  if (f.firstOwnerOnly) chips.push({ key: "firstOwnerOnly", label: "1 owner or fewer" });
  return chips;
}
