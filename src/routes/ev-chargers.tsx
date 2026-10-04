import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Clock,
  ExternalLink,
  Loader2,
  LocateFixed,
  Navigation,
  PlugZap,
  Search,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ChargerMap, type MapView } from "@/components/ChargerMap";
import {
  CONNECTOR_FILTERS,
  MIN_CHARGER_ZOOM,
  SPEED_FILTERS,
  SPEED_INFO,
  chargerDistance,
  directionsLinks,
  fetchChargers,
  kmBetween,
  matchesFilters,
  roundBounds,
  type Charger,
  type ChargerFilters,
  type ConnectorKey,
} from "@/lib/evChargers";
import { lookupDistrict } from "@/lib/marketDeals";
import { postcodeDistrict } from "@/lib/businesses";
import { geocodeAddress } from "@/lib/engagement";
import { useMyPlace } from "@/lib/myArea";
import type { LatLngTuple } from "@/lib/leaflet";

export const Route = createFileRoute("/ev-chargers")({
  head: () => ({
    meta: [
      { title: "EV charger map — find charging points near you | RevMate" },
      {
        name: "description",
        content:
          "Free map of public EV charging points across the UK: rapid and ultra-rapid chargers, plug types (Type 2, CCS, CHAdeMO, Tesla), speeds, costs and directions.",
      },
      { property: "og:title", content: "EV charger map — RevMate" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvChargersPage,
});

const UK: { center: LatLngTuple; zoom: number } = { center: [54.2, -2.6], zoom: 6 };
const LIST_STEP = 30;

function EvChargersPage() {
  const myPlace = useMyPlace();
  const [view, setView] = useState<MapView | null>(null);
  const [filters, setFilters] = useState<ChargerFilters>({
    minKw: 0,
    connectors: [],
    freeOnly: false,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [flyTo, setFlyTo] = useState<{ center: LatLngTuple; zoom: number; key: number } | null>(
    null,
  );
  const [shown, setShown] = useState(LIST_STEP);
  const [startedFromArea, setStartedFromArea] = useState(false);

  // Start on your area if you've set one (it's only a postcode district).
  if (myPlace && !startedFromArea) {
    setStartedFromArea(true);
    setFlyTo({ center: [myPlace.lat, myPlace.lng], zoom: 13, key: Date.now() });
  }

  const zoomedIn = (view?.zoom ?? 0) >= MIN_CHARGER_ZOOM;
  const area = view && zoomedIn ? roundBounds(view.bounds) : null;
  const {
    data: chargers,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["ev-chargers", area],
    queryFn: ({ signal }) => fetchChargers(area!, signal),
    enabled: !!area,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const from = me ?? view?.center ?? null;
  const visible = useMemo(() => {
    if (!chargers || !view || !zoomedIn) return [];
    const b = view.bounds;
    return chargers
      .filter(
        (c) =>
          c.lat >= b.south &&
          c.lat <= b.north &&
          c.lng >= b.west &&
          c.lng <= b.east &&
          matchesFilters(c, filters),
      )
      .map((c) => ({ c, km: from ? kmBetween(from.lat, from.lng, c.lat, c.lng) : 0 }))
      .sort((a, b) => a.km - b.km);
  }, [chargers, view, zoomedIn, filters, from]);
  const selected = visible.find((v) => v.c.id === selectedId) ?? null;

  function locate() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device — search a postcode instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMe(here);
        setFlyTo({ center: [here.lat, here.lng], zoom: 14, key: Date.now() });
        setLocating(false);
      },
      () => {
        toast.error("Allow location access, or search a postcode or town.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      let spot: { lat: number; lng: number } | null = null;
      if (postcodeDistrict(q)) {
        spot = await lookupDistrict(q).catch(() => null);
      }
      spot ??= await geocodeAddress(q);
      if (!spot) {
        toast.error(`We couldn't find "${q}". Try a postcode or town name.`);
        return;
      }
      setSelectedId(null);
      setFlyTo({ center: [spot.lat, spot.lng], zoom: 13, key: Date.now() });
    } finally {
      setSearching(false);
    }
  }

  const toggleConnector = (key: ConnectorKey) =>
    setFilters((f) => ({
      ...f,
      connectors: f.connectors.includes(key)
        ? f.connectors.filter((k) => k !== key)
        : [...f.connectors, key],
    }));

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 sm:px-4">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#34c759] text-white">
          <PlugZap className="size-5" />
        </span>
        EV chargers
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Public charging points near you, with plug types, speeds and directions.
      </p>

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
          onClick={locate}
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
        {SPEED_FILTERS.map((s) => (
          <Chip
            key={s.min}
            active={filters.minKw === s.min}
            onClick={() => setFilters((f) => ({ ...f, minKw: s.min }))}
          >
            {s.min > 0 && <Zap className="size-3.5" />}
            {s.label}
          </Chip>
        ))}
        <span className="w-px shrink-0 bg-border" />
        {CONNECTOR_FILTERS.map((c) => (
          <Chip
            key={c.key}
            active={filters.connectors.includes(c.key)}
            onClick={() => toggleConnector(c.key)}
          >
            {c.label}
          </Chip>
        ))}
        <Chip
          active={filters.freeOnly}
          onClick={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
        >
          Free
        </Chip>
      </div>

      <div className="relative mt-3">
        <ChargerMap
          chargers={visible.map((v) => v.c)}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onViewChange={(next) => {
            setView(next);
            setShown(LIST_STEP);
          }}
          start={myPlace ? { center: [myPlace.lat, myPlace.lng], zoom: 13 } : UK}
          flyTo={flyTo}
          me={me}
        />
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-14">
          <span className="rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold shadow">
            {!zoomedIn ? (
              "Zoom in or search a town to see chargers"
            ) : isFetching ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" /> Finding chargers…
              </span>
            ) : error ? (
              "Couldn't load chargers"
            ) : (
              `${visible.length} charger${visible.length === 1 ? "" : "s"} here`
            )}
          </span>
        </div>
        <Legend />
      </div>

      {error && zoomedIn && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          The charger map is busy right now.
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-foreground"
          >
            Try again
          </button>
        </div>
      )}

      {selected && (
        <ChargerCard
          charger={selected.c}
          km={from ? selected.km : null}
          onClose={() => setSelectedId(null)}
        />
      )}

      {zoomedIn && visible.length > 0 && (
        <section className="mt-4">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {me ? "Nearest to you" : "Nearest to the middle of the map"}
          </h2>
          <ul className="mt-1.5 overflow-hidden rounded-2xl bg-card shadow-sm">
            {visible.slice(0, shown).map(({ c, km }, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(c.id);
                    setFlyTo({
                      center: [c.lat, c.lng],
                      zoom: Math.max(view?.zoom ?? 14, 14),
                      key: Date.now(),
                    });
                  }}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-accent ${i > 0 ? "border-t border-border/70" : ""} ${c.id === selectedId ? "bg-accent" : ""}`}
                >
                  <SpeedBadge charger={c} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[
                        c.operator && c.operator !== c.name.replace(/ charger$/, "")
                          ? c.operator
                          : null,
                        connectorSummary(c),
                        c.fee === "free" ? "Free" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Details not listed"}
                    </span>
                  </span>
                  {from && (
                    <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                      {chargerDistance(km)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {visible.length > shown && (
            <button
              type="button"
              onClick={() => setShown((n) => n + LIST_STEP)}
              className="mt-2 w-full rounded-full bg-muted py-2.5 text-sm font-semibold"
            >
              Show more ({visible.length - shown})
            </button>
          )}
        </section>
      )}

      {zoomedIn && !isFetching && !error && chargers && visible.length === 0 && (
        <p className="mt-4 rounded-2xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">
          No chargers match here.{" "}
          {filters.minKw || filters.connectors.length || filters.freeOnly
            ? "Try fewer filters or zoom out."
            : "Try zooming out."}
        </p>
      )}

      <p className="mt-4 px-1 text-xs text-muted-foreground">
        Charger locations come from{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          OpenStreetMap
        </a>
        , mapped by volunteers. We can't show whether a charger is in use or working right now —
        check the operator's app before a long trip. Your location stays on your phone.
      </p>
    </main>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold transition-colors ${
        active ? "bg-foreground text-background" : "bg-muted text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-6 left-2 z-10 rounded-xl bg-background/95 px-2.5 py-2 text-[11px] font-medium shadow">
      {(["ultra", "rapid", "fast", "slow"] as const).map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full ring-2 ring-white"
            style={{ background: SPEED_INFO[s].colour }}
          />
          {SPEED_INFO[s].label}
        </div>
      ))}
    </div>
  );
}

function SpeedBadge({ charger }: { charger: Charger }) {
  return (
    <span
      className="flex size-11 shrink-0 flex-col items-center justify-center rounded-xl text-white"
      style={{ background: SPEED_INFO[charger.speed].colour }}
    >
      {charger.maxKw !== null ? (
        <>
          <span className="text-sm font-extrabold leading-none tabular-nums">
            {charger.kwEstimated ? "~" : ""}
            {Math.round(charger.maxKw)}
          </span>
          <span className="text-[10px] font-semibold leading-none opacity-90">kW</span>
        </>
      ) : (
        <PlugZap className="size-5" />
      )}
    </span>
  );
}

function connectorSummary(c: Charger) {
  const names = [...new Set(c.connectors.map((k) => k.label.replace(/ \(.*\)$/, "")))];
  return names.slice(0, 3).join(", ");
}

function ChargerCard({
  charger: c,
  km,
  onClose,
}: {
  charger: Charger;
  km: number | null;
  onClose: () => void;
}) {
  const links = directionsLinks(c);
  const speed = SPEED_INFO[c.speed];
  return (
    <section className="mt-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-border">
      <div className="flex items-start gap-3">
        <SpeedBadge charger={c} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold leading-tight">{c.name}</h2>
          <p className="text-sm text-muted-foreground">
            {[c.operator, km !== null ? chargerDistance(km) : null].filter(Boolean).join(" · ")}
          </p>
          {c.address && <p className="text-sm text-muted-foreground">{c.address}</p>}
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

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
        <span className="rounded-full px-2.5 py-1 text-white" style={{ background: speed.colour }}>
          {speed.label}
          {c.maxKw !== null && ` · ${c.kwEstimated ? "about " : "up to "}${Math.round(c.maxKw)} kW`}
        </span>
        {c.fee && (
          <span className="rounded-full bg-muted px-2.5 py-1">
            {c.fee === "free" ? "Free to charge" : "Paid"}
          </span>
        )}
        {c.customersOnly && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-700 dark:text-amber-400">
            Customers only
          </span>
        )}
        {c.parkingFee && <span className="rounded-full bg-muted px-2.5 py-1">Parking fee</span>}
      </div>

      {c.connectors.length > 0 ? (
        <ul className="mt-3 divide-y divide-border/70 rounded-2xl bg-muted/50">
          {c.connectors.map((k) => (
            <li key={k.label} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="font-medium">
                {k.count ? `${k.count} × ` : ""}
                {k.label}
              </span>
              <span className="text-muted-foreground">
                {k.kw ? `${k.kw} kW` : "Speed not listed"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Plug types aren't listed for this one.</p>
      )}

      <dl className="mt-3 space-y-1 text-sm">
        {c.hours && (
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <dd>{c.hours}</dd>
          </div>
        )}
        {c.charge && <DetailRow label="Cost" value={c.charge} />}
        {c.capacity && <DetailRow label="Bays" value={String(c.capacity)} />}
        {c.payment.length > 0 && <DetailRow label="Pay by" value={c.payment.join(", ")} />}
      </dl>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <a
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
          className="col-span-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          <Navigation className="size-4" /> Directions (Google Maps)
        </a>
        <a
          href={links.apple}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center justify-center rounded-full bg-muted text-xs font-semibold"
        >
          Apple Maps
        </a>
        <a
          href={links.waze}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center justify-center rounded-full bg-muted text-xs font-semibold"
        >
          Waze
        </a>
        <a
          href={c.osmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center justify-center gap-1 rounded-full bg-muted text-xs font-semibold"
        >
          Fix info <ExternalLink className="size-3" />
        </a>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
