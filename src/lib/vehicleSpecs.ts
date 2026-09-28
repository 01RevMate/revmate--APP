import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

// Vehicle details on car listings (0043_listing_details.sql): the spec
// sheet on each advert, the extra fields on the sell form and the Buy &
// Sell filters.

export const FUEL_LABELS: Record<string, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  hybrid: "Hybrid",
  plug_in_hybrid: "Plug-in hybrid",
  electric: "Electric",
  lpg: "LPG",
  other: "Other",
};

export const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manual",
  automatic: "Automatic",
  cvt: "Automatic (CVT)",
  dct: "Automatic (dual-clutch)",
  other: "Other",
};

export const BODY_LABELS: Record<string, string> = {
  hatchback: "Hatchback",
  saloon: "Saloon",
  estate: "Estate",
  coupe: "Coupé",
  convertible: "Convertible",
  suv: "SUV",
  mpv: "MPV",
  pickup: "Pickup",
  van: "Van",
  other: "Other",
};

export const SERVICE_LABELS: Record<string, string> = {
  full_dealer: "Full dealer history",
  full: "Full service history",
  partial: "Part service history",
  none: "No service history",
};

export type ListingSpecs = Pick<
  Tables<"listings">,
  | "make"
  | "model"
  | "year"
  | "fuel_type"
  | "transmission"
  | "body_type"
  | "engine_size_cc"
  | "power_bhp"
  | "colour"
  | "doors"
  | "seats"
  | "previous_owners"
  | "mot_expiry"
  | "service_history"
  | "seller_type"
  | "ulez_compliant"
  | "v5c_present"
  | "modified"
>;

export const EMPTY_SPECS: ListingSpecs = {
  make: null,
  model: null,
  year: null,
  fuel_type: null,
  transmission: null,
  body_type: null,
  engine_size_cc: null,
  power_bhp: null,
  colour: null,
  doors: null,
  seats: null,
  previous_owners: null,
  mot_expiry: null,
  service_history: null,
  seller_type: "private",
  ulez_compliant: null,
  v5c_present: null,
  modified: null,
};

/** 1998 → "2.0L". */
export function engineLabel(cc: number | null | undefined): string | null {
  if (!cc) return null;
  return `${(cc / 1000).toFixed(1)}L`;
}

/** Automatic gearboxes of any kind count as "Automatic" in filters. */
export function isAutomatic(transmission: string | null | undefined) {
  return !!transmission && ["automatic", "cvt", "dct"].includes(transmission);
}

/** True once 0043_listing_details.sql has been applied. */
export function useListingDetailsFeature(): boolean {
  const { data } = useQuery({
    queryKey: ["feature", "listing-details"],
    queryFn: async () => !(await supabase.from("listings").select("body_type").limit(1)).error,
    staleTime: Infinity,
    retry: false,
  });
  return data === true;
}

/**
 * Seller-entered details for the spec sheet, in the order buyers scan them
 * (AutoTrader-style "key specs"). Empty values are left out.
 */
export function keySpecs(
  specs: Partial<ListingSpecs> & { mileage?: number | null },
): { label: string; value: string }[] {
  const rows: [string, string | null | undefined][] = [
    ["Year", specs.year ? String(specs.year) : null],
    ["Mileage", specs.mileage != null ? `${specs.mileage.toLocaleString("en-GB")} miles` : null],
    ["Fuel", specs.fuel_type ? FUEL_LABELS[specs.fuel_type] : null],
    ["Gearbox", specs.transmission ? TRANSMISSION_LABELS[specs.transmission] : null],
    ["Body", specs.body_type ? BODY_LABELS[specs.body_type] : null],
    ["Engine", engineLabel(specs.engine_size_cc)],
    ["Power", specs.power_bhp ? `${specs.power_bhp} bhp` : null],
    ["Colour", specs.colour],
    ["Doors", specs.doors ? String(specs.doors) : null],
    ["Seats", specs.seats ? String(specs.seats) : null],
    [
      "Owners",
      specs.previous_owners != null
        ? specs.previous_owners === 0
          ? "First owner"
          : `${specs.previous_owners} previous`
        : null,
    ],
    [
      "MOT until",
      specs.mot_expiry
        ? new Date(`${specs.mot_expiry}T12:00:00`).toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
          })
        : null,
    ],
    ["History", specs.service_history ? SERVICE_LABELS[specs.service_history] : null],
    [
      "ULEZ",
      specs.ulez_compliant == null ? null : specs.ulez_compliant ? "Compliant" : "Not compliant",
    ],
    [
      "V5C logbook",
      specs.v5c_present == null ? null : specs.v5c_present ? "Present" : "Not present",
    ],
    ["Modified", specs.modified == null ? null : specs.modified ? "Yes" : "Standard"],
    ["Seller", specs.seller_type === "trade" ? "Trade seller" : "Private seller"],
  ];
  return rows
    .filter((row): row is [string, string] => !!row[1])
    .map(([label, value]) => ({ label, value }));
}
