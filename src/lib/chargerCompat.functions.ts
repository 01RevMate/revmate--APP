import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CompatHost } from "./chargerCompat.server";

export const getChargerCompatibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { hosts: CompatHost[] }) => ({
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
    const { data: cars } = await context.supabase
      .from("garage_cars")
      .select("make, model, year, trim, spec")
      .eq("user_id", context.userId)
      .eq("fuel_type", "electric")
      .eq("ownership_status", "current")
      .limit(1);
    const car = cars?.[0] ?? null;
    const { explainCompatibility } = await import("./chargerCompat.server");
    try {
      const results = await explainCompatibility(car, data.hosts);
      return { car: car ? `${car.make} ${car.model}` : null, results, error: null as string | null };
    } catch (e) {
      console.error("charger compatibility", e);
      const status = (e as { statusCode?: number })?.statusCode;
      const msg = status === 402 ? "AI credits have run out — compatibility notes are paused." : status === 429 ? "Busy right now — try again in a minute." : "Couldn't check compatibility right now.";
      return { car: car ? `${car.make} ${car.model}` : null, results: [], error: msg };
    }
  });
