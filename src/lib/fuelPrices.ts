// Fuel prices near you — shared types and the call to our own
// /api/fuel-prices endpoint (src/routes/api.fuel-prices.ts), which reads
// the retailers' open price feeds on the server.

export type FuelType = "E10" | "E5" | "B7" | "SDV";

export const FUEL_TYPES: { key: FuelType; label: string; short: string }[] = [
  { key: "E10", label: "Unleaded (E10)", short: "Unleaded" },
  { key: "B7", label: "Diesel (B7)", short: "Diesel" },
  { key: "E5", label: "Super unleaded (E5)", short: "Super" },
  { key: "SDV", label: "Premium diesel", short: "Premium diesel" },
];

export type FuelStation = {
  id: string;
  brand: string;
  address: string;
  postcode: string | null;
  lat: number;
  lng: number;
  /** Pence per litre. */
  prices: Partial<Record<FuelType, number>>;
  /** When the retailer last updated its feed (ISO). */
  updated: string | null;
};

export type FuelFeedStatus = { brand: string; ok: boolean; count: number; updated: string | null };

export type FuelResponse = {
  stations: (FuelStation & { km: number })[];
  feeds: FuelFeedStatus[];
};

export const MAX_FUEL_RADIUS_KM = 40;

export async function fetchFuelPrices(
  lat: number,
  lng: number,
  km: number,
  signal?: AbortSignal,
): Promise<FuelResponse> {
  const params = new URLSearchParams({
    lat: lat.toFixed(3),
    lng: lng.toFixed(3),
    km: String(Math.min(km, MAX_FUEL_RADIUS_KM)),
  });
  const res = await fetch(`/api/fuel-prices?${params}`, { signal: signal ?? null });
  if (!res.ok) throw new Error("Couldn't load fuel prices right now. Try again in a minute.");
  return (await res.json()) as FuelResponse;
}

export function formatPence(p: number) {
  return `${p.toFixed(1)}p`;
}

/** "Today 08:15", "Yesterday", "3 Oct" — how fresh a price is. */
export function priceAge(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  const now = new Date();
  const days = Math.floor(
    (new Date(now.toDateString()).getTime() - new Date(then.toDateString()).getTime()) / 86400000,
  );
  if (days <= 0) {
    return `Today ${then.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (days === 1) return "Yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Older than 3 days: worth a warning, the price may have changed. */
export function isStale(iso: string | null) {
  return !!iso && Date.now() - new Date(iso).getTime() > 3 * 86400000;
}
