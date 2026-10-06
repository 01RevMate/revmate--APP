import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Bounds } from "@/lib/evChargers";
import {
  loadLeaflet,
  TILE_ATTRIBUTION,
  TILE_URL,
  type LatLngTuple,
  type LeafletCircleMarker,
  type LeafletLayer,
  type LeafletLayerGroup,
  type LeafletMap,
  type LeafletStatic,
} from "@/lib/leaflet";

export type MapView = { bounds: Bounds; zoom: number; center: { lat: number; lng: number } };

/** A place on the map: a coloured tag when it has a label, a charger pin, or a dot. */
export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  colour: string;
  label?: string;
  icon?: "charger";
};

// Lucide's "EV charger" glyph, drawn white inside a map pin.
const CHARGER_GLYPH =
  '<path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 7h11"/><path d="m9 11-2 3h3l-2 3"/>';

function chargerPin(colour: string, selected: boolean) {
  const w = selected ? 42 : 32;
  const h = selected ? 54 : 42;
  return {
    html: `<svg class="revmate-charger-pin" width="${w}" height="${h}" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 26.9 16 41 16 41s15-14.1 15-25.2C31 7.6 24.3 1 16 1z" fill="${colour}" stroke="#fff" stroke-width="2"/><g transform="translate(7 6.6) scale(0.75)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${CHARGER_GLYPH}</g></svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h - 1],
  };
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A Leaflet map of places (chargers, fuel stations): tap one to select it. */
export function PointMap({
  points,
  ariaLabel,
  selectedId,
  onSelect,
  onViewChange,
  start,
  flyTo,
  fitKey,
  me,
}: {
  points: MapPoint[];
  ariaLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onViewChange: (view: MapView) => void;
  start: { center: LatLngTuple; zoom: number };
  /** Change this to move the map (e.g. after a search). */
  flyTo: { center: LatLngTuple; zoom: number; key: number } | null;
  /** The viewer's own position, shown as a blue dot. Never leaves the phone. */
  me: { lat: number; lng: number } | null;
  /** Change this to zoom the map so every point (and you) fits on screen. */
  fitKey?: string | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const leaflet = useRef<LeafletStatic | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const dots = useRef<LeafletLayerGroup | null>(null);
  const meDot = useRef<LeafletCircleMarker | null>(null);
  const renderer = useRef<unknown>(null);
  const handlers = useRef({ onSelect, onViewChange });
  handlers.current = { onSelect, onViewChange };
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !el.current) return;
        leaflet.current = L;
        const m = L.map(el.current, { zoomControl: false, attributionControl: true });
        m.setView(start.center, start.zoom, { animate: false });
        L.tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: TILE_ATTRIBUTION,
          className: "revmate-tiles",
        }).addTo(m);
        L.control.zoom({ position: "topright" }).addTo(m);
        renderer.current = L.canvas({ padding: 0.3 });
        dots.current = L.layerGroup().addTo(m);
        const report = () => {
          const b = m.getBounds();
          handlers.current.onViewChange({
            bounds: {
              south: b.getSouth(),
              west: b.getWest(),
              north: b.getNorth(),
              east: b.getEast(),
            },
            zoom: m.getZoom(),
            center: m.getCenter(),
          });
        };
        m.on("moveend", report);
        map.current = m;
        setStatus("ready");
        report();
      })
      .catch(() => !cancelled && setStatus("failed"));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; later moves go through flyTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (flyTo && map.current) map.current.flyTo(flyTo.center, flyTo.zoom, { duration: 0.8 });
  }, [flyTo]);

  useEffect(() => {
    if (!fitKey || !map.current || status !== "ready" || points.length === 0) return;
    const all: LatLngTuple[] = points.map((p) => [p.lat, p.lng]);
    if (me) all.push([me.lat, me.lng]);
    map.current.fitBounds(all, { padding: [56, 56], maxZoom: 15 });
    // Only refit when the caller says so, not every time a point changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, status, points.length > 0]);

  // Redraw the dots whenever the list or the selection changes.
  useEffect(() => {
    const L = leaflet.current;
    if (!L || !dots.current || status !== "ready") return;
    dots.current.clearLayers();
    let selected: LeafletLayer | null = null;
    for (const p of points) {
      const isSelected = p.id === selectedId;
      const layer: LeafletLayer = p.icon
        ? L.marker([p.lat, p.lng], {
            icon: L.divIcon({ className: "", ...chargerPin(p.colour, isSelected) }),
            zIndexOffset: isSelected ? 1000 : 0,
            keyboard: false,
          })
        : p.label
          ? L.marker([p.lat, p.lng], {
              icon: L.divIcon({
                className: "",
                html: `<span class="revmate-pin${isSelected ? " is-selected" : ""}" style="background:${p.colour}">${escapeHtml(p.label)}</span>`,
                iconSize: null,
                iconAnchor: [0, 0],
              }),
              zIndexOffset: isSelected ? 1000 : 0,
              keyboard: false,
            })
          : L.circleMarker([p.lat, p.lng], {
              renderer: renderer.current,
              radius: isSelected ? 11 : 7,
              color: "#ffffff",
              weight: isSelected ? 3 : 2,
              fillColor: p.colour,
              fillOpacity: 1,
            });
      layer.on("click", () => handlers.current.onSelect(p.id));
      layer.addTo(dots.current);
      if (isSelected) selected = layer;
    }
    if (selected && "bringToFront" in selected) (selected as LeafletCircleMarker).bringToFront();
  }, [points, selectedId, status]);

  useEffect(() => {
    const L = leaflet.current;
    if (!L || !map.current || status !== "ready") return;
    meDot.current?.remove();
    meDot.current = me
      ? L.circleMarker([me.lat, me.lng], {
          radius: 8,
          color: "#ffffff",
          weight: 3,
          fillColor: "#0a84ff",
          fillOpacity: 1,
          interactive: false,
        }).addTo(map.current)
      : null;
  }, [me, status]);

  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-border bg-muted shadow-sm">
      <div
        ref={el}
        className="h-[min(46vh,420px)] min-h-[260px] w-full sm:h-[min(56vh,560px)]"
        aria-label={ariaLabel}
      />
      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
          {status === "loading" ? (
            <>
              <Loader2 className="size-6 animate-spin" /> Loading map…
            </>
          ) : (
            "The map couldn't load. Check your connection and try again."
          )}
        </div>
      )}
    </div>
  );
}
