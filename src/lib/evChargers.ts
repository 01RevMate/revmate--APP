// Public EV charge points from OpenStreetMap (free, no key, good UK
// coverage), merged with Open Charge Map when VITE_OCM_KEY is set (free key
// from openchargemap.org; fills gaps and adds "not working" reports). We ask the Overpass API for the chargers inside the part of the
// map you're looking at. Nothing about the viewer is stored: the request
// only carries the map's edges, the same as any map app.
//
// OpenStreetMap doesn't know whether a charger is in use right now, so the
// page says so rather than guessing.

export type SpeedClass = "ultra" | "rapid" | "fast" | "slow" | "unknown";

export type ConnectorKey = "ccs" | "chademo" | "type2" | "tesla" | "type1" | "plug";

export type Connector = {
  key: ConnectorKey;
  label: string;
  count: number | null;
  kw: number | null;
  /** Type 2 with a tethered cable rather than a socket. */
  tethered?: boolean;
};

export type Charger = {
  id: string;
  /** Where to correct the details: the OpenStreetMap or Open Charge Map page. */
  fixUrl: string;
  sources: ("osm" | "ocm")[];
  /** false when Open Charge Map has it reported as not working. */
  working: boolean | null;
  lat: number;
  lng: number;
  name: string;
  operator: string | null;
  address: string | null;
  connectors: Connector[];
  maxKw: number | null;
  /** True when maxKw is a guess from the plug type. */
  kwEstimated: boolean;
  speed: SpeedClass;
  capacity: number | null;
  fee: "free" | "paid" | null;
  charge: string | null;
  hours: string | null;
  customersOnly: boolean;
  parkingFee: boolean | null;
  payment: string[];
};

export type Bounds = { south: number; west: number; north: number; east: number };

// Public Overpass servers; if one is busy or slow we try the next.
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const ENDPOINT_TIMEOUT_MS = 15000;

/** Fewer than this zoom and the area is too big to ask for in one go. */
export const MIN_CHARGER_ZOOM = 11;
const MAX_RESULTS = 800;

// OSM socket tags, in the order drivers look for them.
const SOCKETS: { tag: string; key: ConnectorKey; label: string; tethered?: boolean }[] = [
  { tag: "type2_combo", key: "ccs", label: "CCS" },
  { tag: "chademo", key: "chademo", label: "CHAdeMO" },
  { tag: "tesla_supercharger", key: "tesla", label: "Tesla" },
  { tag: "tesla_supercharger_ccs", key: "ccs", label: "CCS (Tesla)" },
  { tag: "type2", key: "type2", label: "Type 2" },
  { tag: "type2_cable", key: "type2", label: "Type 2 (cable)", tethered: true },
  { tag: "tesla_destination", key: "tesla", label: "Tesla destination" },
  { tag: "type1_combo", key: "ccs", label: "CCS1" },
  { tag: "type1", key: "type1", label: "Type 1" },
  { tag: "bs1363", key: "plug", label: "3-pin plug" },
  { tag: "schuko", key: "plug", label: "Schuko plug" },
];

export const CONNECTOR_FILTERS: { key: ConnectorKey; label: string }[] = [
  { key: "type2", label: "Type 2" },
  { key: "ccs", label: "CCS" },
  { key: "chademo", label: "CHAdeMO" },
  { key: "tesla", label: "Tesla" },
];

export const SPEED_FILTERS: { min: number; label: string }[] = [
  { min: 0, label: "Any speed" },
  { min: 7, label: "7 kW+" },
  { min: 50, label: "50 kW+" },
  { min: 150, label: "150 kW+" },
];

export const SPEED_INFO: Record<SpeedClass, { label: string; colour: string; hint: string }> = {
  ultra: { label: "Ultra-rapid", colour: "#7c3aed", hint: "150 kW+" },
  rapid: { label: "Rapid", colour: "#ea580c", hint: "43–149 kW" },
  fast: { label: "Fast", colour: "#16a34a", hint: "7–42 kW" },
  slow: { label: "Slow", colour: "#2563eb", hint: "Under 7 kW" },
  unknown: { label: "Speed unknown", colour: "#64748b", hint: "Not listed" },
};

/** "50 kW", "22kW;7 kW", "7400 W" → the biggest number, in kW. */
export function parseKw(value: string | undefined): number | null {
  if (!value) return null;
  let best: number | null = null;
  for (const part of value.split(/[;,/]/)) {
    const m = part.trim().match(/^(\d+(?:\.\d+)?)\s*(kw|kva|w)?$/i);
    if (!m) continue;
    let kw = Number(m[1]);
    const unit = (m[2] ?? "kw").toLowerCase();
    if (unit === "w" || kw > 1000) kw = kw / 1000;
    if (kw > 0 && kw < 1000 && (best === null || kw > best)) best = kw;
  }
  return best;
}

function speedFor(kw: number | null): SpeedClass {
  if (kw === null) return "unknown";
  if (kw >= 150) return "ultra";
  if (kw >= 43) return "rapid";
  if (kw >= 7) return "fast";
  return "slow";
}

function countOf(value: string | undefined): number | null {
  if (!value || value === "no") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type OsmTags = {
  [key: string]: string | undefined;
  name?: string;
  operator?: string;
  network?: string;
  brand?: string;
  access?: string;
  disused?: string;
  opening_hours?: string;
  maxpower?: string;
  capacity?: string;
  fee?: string;
  charge?: string;
  parking_fee?: string;
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: OsmTags;
};

/** The fastest listed output, or a guess from the plug types if none is. */
function topSpeed(connectors: Connector[], extraKw: (number | null)[] = []) {
  const listed = [...connectors.map((c) => c.kw), ...extraKw].filter(
    (kw): kw is number => kw !== null,
  );
  let maxKw = listed.length ? Math.max(...listed) : null;
  let kwEstimated = false;
  if (maxKw === null) {
    // No output listed: rapid-only plugs mean a rapid charger.
    if (connectors.some((c) => c.key === "tesla" && c.label === "Tesla")) maxKw = 150;
    else if (connectors.some((c) => c.key === "ccs" || c.key === "chademo")) maxKw = 50;
    else if (connectors.some((c) => c.key === "type2")) maxKw = 7;
    kwEstimated = maxKw !== null;
  }
  return { maxKw, kwEstimated };
}

export function parseCharger(el: OsmElement): Charger | null {
  const tags: OsmTags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;
  // Home and fleet chargers are mapped too; drivers can't use them.
  if (["private", "no", "permit", "delivery"].includes(tags.access ?? "")) return null;
  if (tags.disused === "yes" || tags["disused:amenity"] || tags.opening_hours === "closed") {
    return null;
  }

  const connectors: Connector[] = [];
  for (const socket of SOCKETS) {
    const raw = tags[`socket:${socket.tag}`];
    if (!raw || raw === "no") continue;
    connectors.push({
      key: socket.key,
      label: socket.label,
      count: countOf(raw),
      kw: parseKw(tags[`socket:${socket.tag}:output`]),
      ...(socket.tethered ? { tethered: true } : {}),
    });
  }

  const { maxKw, kwEstimated } = topSpeed(connectors, [
    parseKw(tags["charging_station:output"]),
    parseKw(tags.maxpower),
  ]);

  const operator = tags.operator || tags.network || tags.brand || null;
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const address =
    [street || tags["addr:place"], tags["addr:city"] || tags["addr:town"], tags["addr:postcode"]]
      .filter(Boolean)
      .join(", ") || null;
  const payment = Object.entries(tags)
    .filter(([key, value]) => key.startsWith("payment:") && value === "yes")
    .map(([key]) =>
      key
        .slice("payment:".length)
        .replace(/_/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase()),
    );

  return {
    id: `${el.type}/${el.id}`,
    fixUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    sources: ["osm"],
    working: null,
    lat,
    lng,
    name: tags.name || (operator ? `${operator} charger` : "EV charger"),
    operator,
    address,
    connectors,
    maxKw,
    kwEstimated,
    speed: speedFor(maxKw),
    capacity: countOf(tags.capacity),
    fee: tags.fee === "no" ? "free" : tags.fee === "yes" ? "paid" : null,
    charge: tags.charge || null,
    hours: tags.opening_hours === "24/7" ? "Open 24/7" : tags.opening_hours || null,
    customersOnly: tags.access === "customers",
    parkingFee: tags.parking_fee === "yes" ? true : tags.parking_fee === "no" ? false : null,
    payment,
  };
}

function query(b: Bounds) {
  const box = `${b.south},${b.west},${b.north},${b.east}`;
  return `[out:json][timeout:25];(node["amenity"="charging_station"](${box});way["amenity"="charging_station"](${box}););out center tags ${MAX_RESULTS};`;
}

/** Rounds the edges outwards so small pans reuse the same request. */
export function roundBounds(b: Bounds): Bounds {
  const step = 0.02;
  return {
    south: Math.floor(b.south / step) * step,
    west: Math.floor(b.west / step) * step,
    north: Math.ceil(b.north / step) * step,
    east: Math.ceil(b.east / step) * step,
  };
}

async function fetchOsm(bounds: Bounds, signal?: AbortSignal): Promise<Charger[]> {
  const body = new URLSearchParams({ data: query(bounds) });
  let lastError: unknown = null;
  for (const endpoint of ENDPOINTS) {
    const attempt = new AbortController();
    const onAbort = () => attempt.abort();
    signal?.addEventListener("abort", onAbort);
    const timer = setTimeout(() => attempt.abort(), ENDPOINT_TIMEOUT_MS);
    try {
      // A form body keeps this a "simple" request, so no CORS preflight.
      const res = await fetch(endpoint, { method: "POST", body, signal: attempt.signal });
      if (!res.ok) throw new Error(`Charger lookup failed (${res.status})`);
      const json = (await res.json()) as { elements?: OsmElement[] };
      return (json.elements ?? []).map(parseCharger).filter((c): c is Charger => c !== null);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  console.warn("Charger lookup failed on every server", lastError);
  throw new Error("Couldn't load chargers right now. Try again in a minute.");
}

// ---------- Open Charge Map ----------

const OCM_KEY = import.meta.env["VITE_OCM_KEY"] as string | undefined;
export const OCM_ENABLED = !!OCM_KEY;

type OcmPoi = {
  ID: number;
  UsageCost?: string | null;
  NumberOfPoints?: number | null;
  AddressInfo?: {
    Title?: string | null;
    AddressLine1?: string | null;
    Town?: string | null;
    Postcode?: string | null;
    Latitude: number;
    Longitude: number;
  } | null;
  OperatorInfo?: { Title?: string | null } | null;
  UsageType?: { Title?: string | null } | null;
  StatusType?: { Title?: string | null; IsOperational?: boolean | null } | null;
  Connections?: {
    ConnectionTypeID?: number | null;
    ConnectionType?: { Title?: string | null } | null;
    PowerKW?: number | null;
    Quantity?: number | null;
  }[];
};

// Open Charge Map connection type IDs.
const OCM_TYPES: Record<number, { key: ConnectorKey; label: string; tethered?: boolean }> = {
  33: { key: "ccs", label: "CCS" },
  2: { key: "chademo", label: "CHAdeMO" },
  27: { key: "tesla", label: "Tesla" },
  30: { key: "tesla", label: "Tesla destination" },
  25: { key: "type2", label: "Type 2" },
  1036: { key: "type2", label: "Type 2 (cable)", tethered: true },
  32: { key: "ccs", label: "CCS1" },
  1: { key: "type1", label: "Type 1" },
  3: { key: "plug", label: "3-pin plug" },
  28: { key: "plug", label: "Schuko plug" },
};

function ocmConnectorType(id: number | null | undefined, title: string | null | undefined) {
  if (id && OCM_TYPES[id]) return OCM_TYPES[id];
  const t = (title ?? "").toLowerCase();
  if (t.includes("ccs")) return { key: "ccs" as const, label: "CCS" };
  if (t.includes("chademo")) return { key: "chademo" as const, label: "CHAdeMO" };
  if (t.includes("tesla")) return { key: "tesla" as const, label: "Tesla" };
  if (t.includes("type 2")) return { key: "type2" as const, label: "Type 2" };
  if (t.includes("type 1")) return { key: "type1" as const, label: "Type 1" };
  if (t.includes("bs1363") || t.includes("3 pin"))
    return { key: "plug" as const, label: "3-pin plug" };
  return null;
}

export function parseOcmPoi(poi: OcmPoi): Charger | null {
  const a = poi.AddressInfo;
  if (!a || typeof a.Latitude !== "number" || typeof a.Longitude !== "number") return null;
  const usage = poi.UsageType?.Title ?? "";
  if (/^private/i.test(usage)) return null;
  const status = poi.StatusType?.Title ?? "";
  if (/removed|decommissioned|planned/i.test(status)) return null;

  const byLabel = new Map<string, Connector>();
  for (const conn of poi.Connections ?? []) {
    const type = ocmConnectorType(conn.ConnectionTypeID, conn.ConnectionType?.Title);
    if (!type) continue;
    const existing = byLabel.get(type.label);
    const kw = conn.PowerKW && conn.PowerKW > 0 ? conn.PowerKW : null;
    const count = conn.Quantity && conn.Quantity > 0 ? conn.Quantity : 1;
    if (existing) {
      existing.count = (existing.count ?? 0) + count;
      if (kw && (!existing.kw || kw > existing.kw)) existing.kw = kw;
    } else {
      byLabel.set(type.label, {
        key: type.key,
        label: type.label,
        count,
        kw,
        ...("tethered" in type && type.tethered ? { tethered: true } : {}),
      });
    }
  }
  const connectors = [...byLabel.values()];
  const { maxKw, kwEstimated } = topSpeed(connectors);
  const operatorTitle = poi.OperatorInfo?.Title ?? "";
  const operator = !operatorTitle || operatorTitle.startsWith("(") ? null : operatorTitle;
  const cost = poi.UsageCost?.trim() || null;
  const address = [a.AddressLine1, a.Town, a.Postcode].filter(Boolean).join(", ") || null;
  return {
    id: `ocm/${poi.ID}`,
    fixUrl: `https://map.openchargemap.io/?id=${poi.ID}`,
    sources: ["ocm"],
    working:
      poi.StatusType?.IsOperational === false ? false : poi.StatusType?.IsOperational ? true : null,
    lat: a.Latitude,
    lng: a.Longitude,
    name: a.Title || (operator ? `${operator} charger` : "EV charger"),
    operator,
    address,
    connectors,
    maxKw,
    kwEstimated,
    speed: speedFor(maxKw),
    capacity: poi.NumberOfPoints && poi.NumberOfPoints > 0 ? poi.NumberOfPoints : null,
    fee: cost
      ? /free/i.test(cost)
        ? "free"
        : /£|\d+p\b|pence|per kwh/i.test(cost)
          ? "paid"
          : null
      : null,
    charge: cost,
    hours: null,
    customersOnly: /customer|visitor/i.test(usage),
    parkingFee: null,
    payment: [],
  };
}

async function fetchOcm(bounds: Bounds, signal?: AbortSignal): Promise<Charger[]> {
  if (!OCM_KEY) return [];
  const params = new URLSearchParams({
    output: "json",
    countrycode: "GB",
    maxresults: "500",
    compact: "false",
    verbose: "false",
    boundingbox: `(${bounds.north},${bounds.west}),(${bounds.south},${bounds.east})`,
    key: OCM_KEY,
  });
  const res = await fetch(`https://api.openchargemap.io/v3/poi/?${params}`, {
    signal: signal ?? null,
  });
  if (!res.ok) throw new Error(`Open Charge Map lookup failed (${res.status})`);
  const json = (await res.json()) as OcmPoi[];
  return json.map(parseOcmPoi).filter((c): c is Charger => c !== null);
}

/** Same charger in both lists (within ~60 m): keep one, filling its gaps. */
export function mergeChargers(osm: Charger[], ocm: Charger[]): Charger[] {
  const merged = osm.map((c) => ({ ...c }));
  for (const extra of ocm) {
    const twin = merged.find(
      (c) => c.sources.includes("osm") && kmBetween(c.lat, c.lng, extra.lat, extra.lng) < 0.06,
    );
    if (!twin) {
      merged.push(extra);
      continue;
    }
    twin.sources = ["osm", "ocm"];
    twin.working = extra.working;
    twin.operator ??= extra.operator;
    twin.address ??= extra.address;
    twin.charge ??= extra.charge;
    twin.fee ??= extra.fee;
    twin.capacity ??= extra.capacity;
    if (twin.connectors.length === 0) twin.connectors = extra.connectors;
    if (extra.maxKw !== null && !extra.kwEstimated && (twin.kwEstimated || twin.maxKw === null)) {
      twin.maxKw = extra.maxKw;
      twin.kwEstimated = false;
      twin.speed = extra.speed;
    }
    if (twin.name === "EV charger" || twin.name.endsWith(" charger")) twin.name = extra.name;
  }
  return merged;
}

/** Chargers in the box from every source we have; one source failing is fine. */
export async function fetchChargers(bounds: Bounds, signal?: AbortSignal): Promise<Charger[]> {
  const [osm, ocm] = await Promise.allSettled([fetchOsm(bounds, signal), fetchOcm(bounds, signal)]);
  if (osm.status === "rejected" && (ocm.status === "rejected" || !OCM_ENABLED)) throw osm.reason;
  if (ocm.status === "rejected") console.warn("Open Charge Map lookup failed", ocm.reason);
  return mergeChargers(
    osm.status === "fulfilled" ? osm.value : [],
    ocm.status === "fulfilled" ? ocm.value : [],
  );
}

/** A box roughly `km` each way around a point, for "chargers near me". */
export function boundsAround(lat: number, lng: number, km: number): Bounds {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return roundBounds({ south: lat - dLat, west: lng - dLng, north: lat + dLat, east: lng + dLng });
}

export type ChargerFilters = { minKw: number; connectors: ConnectorKey[]; freeOnly: boolean };

export function matchesFilters(c: Charger, f: ChargerFilters): boolean {
  if (f.minKw > 0 && (c.maxKw === null || c.maxKw < f.minKw)) return false;
  if (f.connectors.length && !c.connectors.some((k) => f.connectors.includes(k.key))) return false;
  if (f.freeOnly && c.fee !== "free") return false;
  return true;
}

export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Chargers are public places, so a precise distance is fine here. */
export function chargerDistance(km: number): string {
  const miles = km / 1.609;
  if (miles < 0.1) return "Here";
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}
