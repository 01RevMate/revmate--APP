// Leaflet 1.9.4 is shipped with the app in public/vendor (BSD-2 licence) and
// loaded only on pages with a map, so it never slows anything else down and
// no third-party script host is involved. These are the few parts we use.

const BASE = "/vendor/leaflet-1.9.4";

export type LatLngTuple = [number, number];

export interface LeafletEvent {
  latlng?: { lat: number; lng: number };
}

export interface LeafletLayer {
  addTo(target: LeafletMap | LeafletLayerGroup): this;
  remove(): this;
  on(event: string, handler: (e: LeafletEvent) => void): this;
}

export interface LeafletCircleMarker extends LeafletLayer {
  setStyle(style: Record<string, unknown>): this;
  bringToFront(): this;
}

export interface LeafletLayerGroup extends LeafletLayer {
  clearLayers(): this;
}

export interface LeafletMap {
  setView(center: LatLngTuple, zoom: number, options?: { animate?: boolean }): this;
  flyTo(center: LatLngTuple, zoom?: number, options?: { duration?: number }): this;
  fitBounds(bounds: LatLngTuple[], options?: Record<string, unknown>): this;
  panTo(center: LatLngTuple, options?: { animate?: boolean }): this;
  getZoom(): number;
  getCenter(): { lat: number; lng: number };
  getBounds(): {
    getSouth(): number;
    getWest(): number;
    getNorth(): number;
    getEast(): number;
  };
  invalidateSize(): this;
  on(event: string, handler: (e: LeafletEvent) => void): this;
  remove(): this;
}

export interface LeafletStatic {
  map(el: HTMLElement, options?: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options?: Record<string, unknown>): LeafletLayer;
  circleMarker(at: LatLngTuple, options?: Record<string, unknown>): LeafletCircleMarker;
  marker(at: LatLngTuple, options?: Record<string, unknown>): LeafletLayer;
  divIcon(options: Record<string, unknown>): unknown;
  layerGroup(): LeafletLayerGroup;
  canvas(options?: Record<string, unknown>): unknown;
  control: { zoom(options?: Record<string, unknown>): LeafletLayer };
}

let loading: Promise<LeafletStatic> | null = null;

export function loadLeaflet(): Promise<LeafletStatic> {
  const existing = (window as unknown as { L?: LeafletStatic }).L;
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<LeafletStatic>((resolve, reject) => {
    if (!document.querySelector(`link[href="${BASE}/leaflet.css"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = `${BASE}/leaflet.css`;
      document.head.appendChild(css);
    }
    const script = document.createElement("script");
    script.src = `${BASE}/leaflet.js`;
    script.async = true;
    script.onload = () => {
      const L = (window as unknown as { L?: LeafletStatic }).L;
      if (L) resolve(L);
      else reject(new Error("The map didn't load."));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("The map didn't load. Check your connection."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Map tiles. OpenStreetMap's own tiles by default; set VITE_MAP_TILE_URL
 * (and VITE_MAP_TILE_ATTRIBUTION) to use a keyed provider once traffic grows. */
export const TILE_URL =
  (import.meta.env["VITE_MAP_TILE_URL"] as string | undefined) ??
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  (import.meta.env["VITE_MAP_TILE_ATTRIBUTION"] as string | undefined) ??
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
