// Live UK pump prices from the open data feeds big fuel retailers publish
// under the CMA's road fuel price scheme (one JSON file per retailer, the
// same shape for all). Fetched on our server — most feeds don't allow
// browsers to read them directly — merged, and cached for 30 minutes.
//
// A feed that's down or has moved is skipped; the rest still work.

import type { FuelStation, FuelType, FuelFeedStatus } from "@/lib/fuelPrices";

export const FUEL_FEEDS: { brand: string; url: string }[] = [
  { brand: "Applegreen", url: "https://applegreenstores.com/fuel-prices/data.json" },
  { brand: "Ascona", url: "https://fuelprices.asconagroup.co.uk/newfuel.json" },
  { brand: "Asda", url: "https://storelocator.asda.com/fuel_prices_data.json" },
  {
    brand: "BP",
    url: "https://www.bp.com/en_gb/united-kingdom/home/fuelprices/fuel_prices_data.json",
  },
  { brand: "Esso", url: "https://fuelprices.esso.co.uk/latestdata.json" },
  { brand: "JET", url: "https://jetlocal.co.uk/fuel_prices_data.json" },
  { brand: "Karan", url: "https://api2.krlmedia.com/integration/live_price/krl" },
  { brand: "Morrisons", url: "https://www.morrisons.com/fuel-prices/fuel.json" },
  { brand: "Moto", url: "https://moto-way.com/fuel-price/fuel_prices.json" },
  { brand: "MFG", url: "https://fuel.motorfuelgroup.com/fuel_prices_data.json" },
  {
    brand: "Rontec",
    url: "https://www.rontec-servicestations.co.uk/fuel-prices/data/fuel_data.json",
  },
  {
    brand: "Sainsbury's",
    url: "https://api.sainsburys.co.uk/v1/exports/latest/fuel_prices_data.json",
  },
  { brand: "SGN", url: "https://www.sgnretail.uk/files/data/SGN_daily_fuel_prices.json" },
  { brand: "Shell", url: "https://www.shell.co.uk/fuel-prices-data.html" },
  { brand: "Tesco", url: "https://www.tesco.com/fuel_prices/fuel_prices_data.json" },
];

const FEED_TIMEOUT_MS = 8000;
const CACHE_MS = 30 * 60 * 1000;
const FUEL_KEYS: FuelType[] = ["E10", "E5", "B7", "SDV"];

type RawStation = {
  site_id?: string | number;
  brand?: string;
  address?: string;
  postcode?: string;
  location?: { latitude?: number | string; longitude?: number | string };
  prices?: Record<string, number | string | null | undefined>;
};

/** Pence per litre, whether a feed sends 139.9, 1.399 or 1399. */
export function toPence(value: unknown): number | null {
  const n =
    typeof value === "string" ? Number(value.trim()) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  let p = n;
  if (p < 10) p = p * 100;
  else if (p > 1000) p = p / 10;
  // Anything outside this is a typo in the feed, not a real price.
  return p >= 80 && p <= 300 ? Math.round(p * 10) / 10 : null;
}

/** A wall-clock time in the UK (GMT or BST) as a real instant. */
function fromLondonTime(y: number, mo: number, d: number, h: number, mi: number, sec: number) {
  const asUtc = Date.UTC(y, mo, d, h, mi, sec);
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(asUtc)),
  );
  const offsetHours = (londonHour - new Date(asUtc).getUTCHours() + 24) % 24;
  return new Date(asUtc - offsetHours * 3600000);
}

/** "02/10/2026 08:15:00" (UK order) or an ISO date → ISO string. */
export function parseFeedDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const uk = value
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  const date = uk
    ? fromLondonTime(
        Number(uk[3]),
        Number(uk[2]) - 1,
        Number(uk[1]),
        Number(uk[4] ?? 0),
        Number(uk[5] ?? 0),
        Number(uk[6] ?? 0),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseFeed(
  feedBrand: string,
  json: unknown,
): { stations: FuelStation[]; updated: string | null } {
  const body = (json ?? {}) as { last_updated?: string; stations?: RawStation[] };
  const updated = parseFeedDate(body.last_updated);
  const stations: FuelStation[] = [];
  for (const raw of Array.isArray(body.stations) ? body.stations : []) {
    const lat = Number(raw.location?.latitude);
    const lng = Number(raw.location?.longitude);
    // UK only, and skip stations with no usable position.
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 49 ||
      lat > 61 ||
      lng < -9 ||
      lng > 2.5
    ) {
      continue;
    }
    const prices: Partial<Record<FuelType, number>> = {};
    for (const key of FUEL_KEYS) {
      const p = toPence(raw.prices?.[key]);
      if (p !== null) prices[key] = p;
    }
    if (Object.keys(prices).length === 0) continue;
    const brand = (raw.brand || feedBrand).trim();
    stations.push({
      id: `${feedBrand}:${raw.site_id ?? `${lat},${lng}`}`,
      brand,
      address: (raw.address ?? "").trim() || brand,
      postcode: (raw.postcode ?? "").trim() || null,
      lat,
      lng,
      prices,
      updated,
    });
  }
  return { stations, updated };
}

async function fetchFeed(feed: { brand: string; url: string }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "RevMate/1.0 (+https://revmate.co.uk)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseFeed(feed.brand, await res.json());
  } finally {
    clearTimeout(timer);
  }
}

type Snapshot = { at: number; stations: FuelStation[]; feeds: FuelFeedStatus[] };
let cache: Snapshot | null = null;
let inFlight: Promise<Snapshot> | null = null;

/** Every station from every feed that answered, cached for 30 minutes. */
export async function getAllFuelStations(): Promise<Snapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  inFlight ??= (async () => {
    const results = await Promise.allSettled(FUEL_FEEDS.map(fetchFeed));
    const stations: FuelStation[] = [];
    const feeds: FuelFeedStatus[] = results.map((r, i) => {
      const brand = FUEL_FEEDS[i]!.brand;
      if (r.status === "fulfilled") {
        stations.push(...r.value.stations);
        return { brand, ok: true, count: r.value.stations.length, updated: r.value.updated };
      }
      return { brand, ok: false, count: 0, updated: null };
    });
    const snapshot = { at: Date.now(), stations, feeds };
    // Don't cache a total failure for half an hour — try again next time.
    if (stations.length > 0) cache = snapshot;
    return snapshot;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
