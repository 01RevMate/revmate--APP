import { createFileRoute } from "@tanstack/react-router";
import { getAllFuelStations } from "@/lib/fuelFeeds";
import { MAX_FUEL_RADIUS_KM, type FuelResponse } from "@/lib/fuelPrices";
import { kmBetween } from "@/lib/evChargers";

// Fuel stations and prices within `km` of a point, nearest first. The app
// sends a point rounded to ~100 m; nothing about the caller is stored.
export const Route = createFileRoute("/api/fuel-prices")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lat = Number(url.searchParams.get("lat"));
        const lng = Number(url.searchParams.get("lng"));
        const km = Math.min(Number(url.searchParams.get("km")) || 8, MAX_FUEL_RADIUS_KM);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180
        ) {
          return Response.json({ error: "lat and lng are required" }, { status: 400 });
        }
        const { stations, feeds } = await getAllFuelStations();
        const nearby = stations
          .map((s) => ({ ...s, km: kmBetween(lat, lng, s.lat, s.lng) }))
          .filter((s) => s.km <= km)
          .sort((a, b) => a.km - b.km)
          .slice(0, 300);
        const body: FuelResponse = { stations: nearby, feeds };
        return Response.json(body, {
          status: stations.length === 0 ? 503 : 200,
          headers: { "Cache-Control": "public, max-age=300" },
        });
      },
    },
  },
});
