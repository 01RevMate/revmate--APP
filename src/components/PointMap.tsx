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

/** A place on the map: a coloured dot, or a coloured tag when it has a label. */
export type MapPoint = { id: string; lat: number; lng: number; colour: string; label?: string };

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

  // Redraw the dots whenever the list or the selection changes.
  useEffect(() => {
    const L = leaflet.current;
    if (!L || !dots.current || status !== "ready") return;
    dots.current.clearLayers();
    let selected: LeafletLayer | null = null;
    for (const p of points) {
      const isSelected = p.id === selectedId;
      const layer: LeafletLayer = p.label
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
      <div ref={el} className="h-[52vh] min-h-[320px] w-full" aria-label={ariaLabel} />
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
