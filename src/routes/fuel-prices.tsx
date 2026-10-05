import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Fuel,
  List,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  Navigation,
  Search,
  TrendingDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PointMap } from "@/components/PointMap";
import {
  FUEL_TYPES,
  fetchFuelPrices,
  formatPence,
  isStale,
  priceAge,
  type FuelStation,
  type FuelType,
} from "@/lib/fuelPrices";
import { chargerDistance } from "@/lib/evChargers";
import { lookupDistrict } from "@/lib/marketDeals";
import { postcodeDistrict } from "@/lib/businesses";
import { geocodeAddress } from "@/lib/engagement";
import { useMyPlace } from "@/lib/myArea";
import type { LatLngTuple } from "@/lib/leaflet";

export const Route = createFileRoute("/fuel-prices")({
  head: () => ({
    meta: [
      { title: "Cheapest petrol & diesel near you — live UK fuel prices | RevMate" },
      {
        name: "description",
        content:
          "Compare today's petrol and diesel prices at fuel stations near you: unleaded, diesel, super unleaded and premium diesel, cheapest first, with directions.",
      },
      { property: "og:title", content: "Fuel prices near you — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FuelPricesPage,
});

type Origin = { lat: number; lng: number; label: string };
type Station = FuelStation & { km: number };
const RADII_KM = [8, 25];
const FUEL_KEY = "revmate:fuelType";
const TANK_LITRES = 50;

function FuelPricesPage() {
  const myPlace = useMyPlace();
  const [fuel, setFuel] = useState<FuelType>("E10");
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [mode, setMode] = useState<"list" | "map">("list");
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [radiusKm, setRadiusKm] = useState(RADII_KM[0]!);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<{ center: LatLngTuple; zoom: number; key: number } | null>(
    null,
  );

  // Remember the fuel you buy on this phone.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FUEL_KEY);
      if (saved && FUEL_TYPES.some((f) => f.key === saved)) setFuel(saved as FuelType);
    } catch {
      // Storage blocked: just default to unleaded.
    }
  }, []);
  function pickFuel(next: FuelType) {
    setFuel(next);
    try {
      localStorage.setItem(FUEL_KEY, next);
    } catch {
      // Not saved; fine for this visit.
    }
  }

  function goTo(next: Origin) {
    setOrigin(next);
    setRadiusKm(RADII_KM[0]!);
    setSelectedId(null);
    setFlyTo({ center: [next.lat, next.lng], zoom: 13, key: Date.now() });
  }

  function locate(quiet = false) {
    if (!navigator.geolocation) {
      if (!quiet)
        toast.error("Location isn't available on this device — search a postcode instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        goTo({ ...here, label: "you" });
        setLocating(false);
      },
      () => {
        if (!quiet) toast.error("Allow location access, or search a postcode or town.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60000 },
    );
  }

  useEffect(() => {
    let cancelled = false;
    void navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === "granted") locate(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (myPlace && !origin && !locating) {
      goTo({ lat: myPlace.lat, lng: myPlace.lng, label: myPlace.district });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myPlace]);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["fuel-prices", origin && [origin.lat.toFixed(3), origin.lng.toFixed(3)], radiusKm],
    queryFn: ({ signal }) => fetchFuelPrices(origin!.lat, origin!.lng, radiusKm, signal),
    enabled: !!origin,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const stations = useMemo(() => {
    const withFuel = (data?.stations ?? []).filter((s) => s.prices[fuel] !== undefined);
    return [...withFuel].sort((a, b) =>
      sort === "price" ? a.prices[fuel]! - b.prices[fuel]! || a.km - b.km : a.km - b.km,
    );
  }, [data, fuel, sort]);

  const prices = stations.map((s) => s.prices[fuel]!).sort((a, b) => a - b);
  const cheapest = prices[0];
  const average = prices.length ? prices.reduce((t, p) => t + p, 0) / prices.length : null;
  const cheapestStation = stations.find((s) => s.prices[fuel] === cheapest) ?? null;
  // Green for the cheapest third, amber, then red.
  const band = (p: number) => {
    if (prices.length < 3) return "#16a34a";
    const i = prices.indexOf(p) / (prices.length - 1);
    return i <= 1 / 3 ? "#16a34a" : i <= 2 / 3 ? "#d97706" : "#dc2626";
  };
  const fuelLabel = FUEL_TYPES.find((f) => f.key === fuel)!;
  const selected = stations.find((s) => s.id === selectedId) ?? null;
  const workingFeeds = data?.feeds.filter((f) => f.ok).length ?? 0;

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      let spot: { lat: number; lng: number } | null = null;
      if (postcodeDistrict(q)) spot = await lookupDistrict(q).catch(() => null);
      spot ??= await geocodeAddress(q);
      if (!spot) {
        toast.error(`We couldn't find "${q}". Try a postcode or town name.`);
        return;
      }
      goTo({ ...spot, label: q });
    } finally {
      setSearching(false);
    }
  }

  function showOnMap(s: Station) {
    setSelectedId(s.id);
    setFlyTo({ center: [s.lat, s.lng], zoom: 15, key: Date.now() });
    setMode("map");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#ff9500] text-white">
            <Fuel className="size-5" />
          </span>
          Fuel prices
        </h1>
        <div
          role="tablist"
          aria-label="View"
          className="grid grid-cols-2 rounded-full bg-muted p-1"
        >
          {(
            [
              ["list", "List", List],
              ["map", "Map", MapIcon],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={`flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${
                mode === id ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={runSearch} className="mt-3 flex gap-2">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full border border-input bg-background px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Postcode or town"
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {searching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </label>
        <button
          type="button"
          onClick={() => locate()}
          disabled={locating}
          className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LocateFixed className="size-4" />
          )}
          Near me
        </button>
      </form>

      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden">
        {FUEL_TYPES.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={fuel === f.key}
            onClick={() => pickFuel(f.key)}
            className={`flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold ${
              fuel === f.key ? "bg-foreground text-background" : "bg-muted text-foreground"
            }`}
          >
            {f.short}
          </button>
        ))}
      </div>

      {!origin && (
        <section className="mt-4 flex flex-col items-center rounded-3xl bg-card p-6 text-center shadow-sm ring-1 ring-border">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ff9500] text-white">
            <Fuel className="size-7" />
          </span>
          <h2 className="mt-3 text-lg font-bold">Find the cheapest fuel near you</h2>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Use your location or search a postcode or town to compare today's pump prices.
          </p>
          <button
            type="button"
            onClick={() => locate()}
            disabled={locating}
            className="mt-4 flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {locating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LocateFixed className="size-4" />
            )}
            Use my location
          </button>
        </section>
      )}

      {origin && cheapestStation && cheapest !== undefined && average !== null && (
        <button
          type="button"
          onClick={() => setSelectedId(cheapestStation.id)}
          className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-left text-white shadow-sm"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <TrendingDown className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-white/80">
              Cheapest {fuelLabel.short.toLowerCase()} near {origin.label}
            </span>
            <span className="block text-2xl font-extrabold tabular-nums">
              {formatPence(cheapest)}
            </span>
            <span className="block truncate text-sm text-white/90">
              {cheapestStation.brand} · {cheapestStation.address} ·{" "}
              {chargerDistance(cheapestStation.km)}
            </span>
            {average - cheapest >= 1 && (
              <span className="mt-1 block text-xs font-semibold text-white/90">
                About £{(((average - cheapest) * TANK_LITRES) / 100).toFixed(2)} less than average
                on a {TANK_LITRES}-litre fill
              </span>
            )}
          </span>
        </button>
      )}

      {origin && (
        <div className="mt-3 flex items-center justify-between gap-2 px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {stations.length} station{stations.length === 1 ? "" : "s"} within{" "}
            {Math.round(radiusKm / 1.609)} miles
          </p>
          <div className="grid grid-cols-2 rounded-full bg-muted p-0.5 text-xs font-semibold">
            {(
              [
                ["price", "Cheapest"],
                ["distance", "Nearest"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={sort === id}
                onClick={() => setSort(id)}
                className={`rounded-full px-3 py-1.5 ${sort === id ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "map" && (
        <div className="mt-3">
          <PointMap
            ariaLabel="Map of fuel stations and prices"
            points={stations.map((s) => ({
              id: s.id,
              lat: s.lat,
              lng: s.lng,
              colour: band(s.prices[fuel]!),
              label: s.prices[fuel]!.toFixed(1),
            }))}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onViewChange={() => undefined}
            start={
              selected
                ? { center: [selected.lat, selected.lng], zoom: 15 }
                : origin
                  ? { center: [origin.lat, origin.lng], zoom: 13 }
                  : { center: [54.2, -2.6], zoom: 6 }
            }
            flyTo={flyTo}
            me={me}
          />
          {selected && (
            <StationCard
              station={selected}
              fuel={fuel}
              colour={band(selected.prices[fuel]!)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}

      {origin && isFetching && stations.length === 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking prices near {origin.label}…
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          Fuel prices are busy right now.
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground"
          >
            Try again
          </button>
        </div>
      )}

      {mode === "list" && stations.length > 0 && (
        <ul className="mt-2 space-y-2">
          {stations.slice(0, 60).map((s) =>
            s.id === selectedId ? (
              <li key={s.id}>
                <StationCard
                  station={s}
                  fuel={fuel}
                  colour={band(s.prices[fuel]!)}
                  onClose={() => setSelectedId(null)}
                  onShowOnMap={() => showOnMap(s)}
                />
              </li>
            ) : (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-sm ring-1 ring-border"
                >
                  <span
                    className="flex h-12 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl text-white"
                    style={{ background: band(s.prices[fuel]!) }}
                  >
                    <span className="text-lg font-extrabold leading-none tabular-nums">
                      {s.prices[fuel]!.toFixed(1)}
                    </span>
                    <span className="text-[10px] font-semibold opacity-90">pence/litre</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{s.brand}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.address}
                    </span>
                    <span
                      className={`block text-[11px] ${isStale(s.updated) ? "text-amber-600" : "text-muted-foreground"}`}
                    >
                      {priceAge(s.updated) ? `Updated ${priceAge(s.updated)}` : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">
                    {chargerDistance(s.km)}
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {origin && data && !isFetching && stations.length === 0 && (
        <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">
          No {fuelLabel.short.toLowerCase()} prices found near {origin.label}.
          {radiusKm < RADII_KM[RADII_KM.length - 1]! && (
            <button
              type="button"
              onClick={() => setRadiusKm(RADII_KM[RADII_KM.length - 1]!)}
              className="mx-auto mt-3 block rounded-full bg-background px-4 py-2 text-sm font-semibold text-foreground"
            >
              Search wider (15 miles)
            </button>
          )}
        </div>
      )}

      {origin &&
        stations.length > 0 &&
        stations.length < 5 &&
        radiusKm < RADII_KM[RADII_KM.length - 1]! && (
          <button
            type="button"
            onClick={() => setRadiusKm(RADII_KM[RADII_KM.length - 1]!)}
            className="mt-2 w-full rounded-full bg-muted py-2.5 text-sm font-semibold"
          >
            Search wider (15 miles)
          </button>
        )}

      <p className="mt-4 px-1 text-xs text-muted-foreground">
        Prices come from the open data fuel retailers publish
        {workingFeeds
          ? ` (${workingFeeds} retailer${workingFeeds === 1 ? "" : "s"} right now)`
          : ""}
        , so mainly supermarkets and big brands — not every station is listed. Retailers update them
        through the day; always check the price at the pump. Distances are as the crow flies, and
        your location stays on your phone.
      </p>
    </main>
  );
}

function StationCard({
  station: s,
  fuel,
  colour,
  onClose,
  onShowOnMap,
}: {
  station: Station;
  fuel: FuelType;
  colour: string;
  onClose: () => void;
  onShowOnMap?: () => void;
}) {
  const dest = `${s.lat},${s.lng}`;
  return (
    <section className="mt-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-border first:mt-0">
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-xl text-white"
          style={{ background: colour }}
        >
          <span className="text-lg font-extrabold leading-none tabular-nums">
            {s.prices[fuel]!.toFixed(1)}
          </span>
          <span className="text-[10px] font-semibold opacity-90">pence/litre</span>
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{s.brand}</h2>
          <p className="text-sm text-muted-foreground">
            {[s.address, s.postcode].filter(Boolean).join(", ")} · {chargerDistance(s.km)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
        >
          <X className="size-5" />
        </button>
      </div>

      <ul className="mt-3 grid grid-cols-2 gap-2">
        {FUEL_TYPES.map((f) => (
          <li
            key={f.key}
            className={`rounded-2xl px-3 py-2 ${f.key === fuel ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/60"}`}
          >
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="text-lg font-bold tabular-nums">
              {s.prices[f.key] !== undefined ? formatPence(s.prices[f.key]!) : "—"}
            </p>
          </li>
        ))}
      </ul>

      {s.updated && (
        <p
          className={`mt-2 flex items-center gap-1.5 text-xs ${isStale(s.updated) ? "text-amber-600" : "text-muted-foreground"}`}
        >
          {isStale(s.updated) && <AlertTriangle className="size-3.5" />}
          Prices updated {priceAge(s.updated)}
          {isStale(s.updated) && " — may have changed"}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${dest}`}
          target="_blank"
          rel="noopener noreferrer"
          className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          <Navigation className="size-4" /> Directions (Google Maps)
        </a>
        {onShowOnMap && (
          <button
            type="button"
            onClick={onShowOnMap}
            className="col-span-2 flex min-h-10 items-center justify-center gap-2 rounded-full bg-muted text-sm font-semibold"
          >
            <MapIcon className="size-4" /> Show on map
          </button>
        )}
        <a
          href={`https://maps.apple.com/?daddr=${dest}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center justify-center rounded-full bg-muted text-xs font-semibold"
        >
          Apple Maps
        </a>
        <a
          href={`https://waze.com/ul?ll=${dest}&navigate=yes`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center justify-center rounded-full bg-muted text-xs font-semibold"
        >
          Waze
        </a>
      </div>
    </section>
  );
}
