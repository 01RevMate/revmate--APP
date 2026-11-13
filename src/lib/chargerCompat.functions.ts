import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompatHost } from "./chargerCompat.server";
import { chargingCarLabel, defaultChargingCar, type ChargingVehicle } from "./evVehicle";

export const getChargerCompatibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hosts: CompatHost[]; garageCarId?: string | undefined; vehicle?: ChargingVehicle | null | undefined; connector?: string | undefined }) => ({
    garageCarId: input.garageCarId?.slice(0, 40),
    vehicle: input.vehicle ? {
      make: String(input.vehicle.make).slice(0, 40), model: String(input.vehicle.model).slice(0, 60),
      year: input.vehicle.year && Number.isInteger(input.vehicle.year) && input.vehicle.year >= 1900 && input.vehicle.year <= 2100 ? input.vehicle.year : null,
      trim: input.vehicle.trim?.slice(0, 80) ?? null, spec: input.vehicle.spec?.slice(0, 100) ?? null,
      engine: input.vehicle.engine?.slice(0, 80) ?? null, fuel_type: input.vehicle.fuel_type?.slice(0, 20) ?? null,
    } : null,
    connector: ["type2", "three_pin"].includes(input.connector ?? "") ? input.connector : "not_sure",
    hosts: (Array.isArray(input?.hosts) ? input.hosts : []).slice(0, 25).map((h) => ({
      host_id: String(h.host_id).slice(0, 40),
      connector: String(h.connector).slice(0, 20),
      kw: Number(h.kw) || 0,
      fits: String(h.fits).slice(0, 20),
      notes: h.notes ? String(h.notes).slice(0, 200) : null,
    })),
  }))
  .handler(async ({ data, context }) => {
    if (!data.hosts.length) return { car: null, results: [] };
    const { data: cars, error } = await context.supabase
      .from("garage_cars")
      .select("id, make, model, year, trim, spec, engine, fuel_type, ownership_status")
      .eq("user_id", context.userId)
      .eq("ownership_status", "current");
    if (error) throw error;
    const car = data.vehicle ?? (data.garageCarId ? cars?.find((car) => car.id === data.garageCarId) ?? null : defaultChargingCar(cars ?? []));
    if (data.garageCarId && !car) throw new Error("Choose one of your current cars or enter another car.");
    const { explainCompatibility } = await import("./chargerCompat.server");
    try {
      const results = await explainCompatibility(car ? { ...car, connector: data.connector ?? "not_sure" } : null, data.hosts);
      return { car: chargingCarLabel(car) || null, results, error: null as string | null };
    } catch (e) {
      console.error("charger compatibility", e);
      const status = (e as { statusCode?: number })?.statusCode;
      const msg = status === 402 ? "AI credits have run out — compatibility notes are paused." : status === 429 ? "Busy right now — try again in a minute." : "Couldn't check compatibility right now.";
      return { car: chargingCarLabel(car) || null, results: [], error: msg };
    }
  });
