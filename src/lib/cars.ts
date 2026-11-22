import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { canonicalApprovedVehicleMake } from "@/lib/approvedVehicleMakes";

export type Car = Tables<"cars">;
/**
 * A fault. `source` is "ai" | "owner" | "editorial" (editorial, `cost_source_url` and `last_checked`
 * arrive with migration 0084, so they are optional until the generated types catch up).
 */
export type CarFault = Omit<Tables<"car_faults">, "source"> & {
  source: "ai" | "owner" | "editorial";
  cost_source_url?: string | null;
  last_checked?: string | null;
};
export type Listing = Tables<"listings">;

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, "-");
}

export type EngineOption = {
  name?: string;
  power_bhp?: number;
  fuel?: string;
  gearbox?: string;
};

export function engineOptions(car: Car): EngineOption[] {
  if (!Array.isArray(car.engine_options)) return [];
  return car.engine_options as EngineOption[];
}

export function carPath(car: Pick<Car, "make" | "model" | "generation">) {
  return {
    to: "/cars/$make/$model/$generation" as const,
    params: {
      make: slugify(car.make),
      model: slugify(car.model),
      generation: slugify(car.generation),
    },
  };
}

export function carLabel(car: Pick<Car, "make" | "model" | "generation">) {
  return `${car.make} ${car.model} — ${car.generation}`;
}

export function yearRange(car: Pick<Car, "year_start" | "year_end">) {
  if (!car.year_start) return "—";
  return `${car.year_start}–${car.year_end ?? "now"}`;
}

export async function fetchCars(search?: string) {
  let query = supabase.from("cars").select("*").order("make").order("model");
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`make.ilike.${term},model.ilike.${term},generation.ilike.${term}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data
    .map((car) => {
      const make = canonicalApprovedVehicleMake(car.make);
      return make ? { ...car, make } : null;
    })
    .filter((car): car is Car => car !== null);
}

export async function fetchCarBySlug(make: string, model: string, generation: string) {
  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .eq("make_slug", make)
    .eq("model_slug", model)
    .eq("generation_slug", generation)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const approvedMake = canonicalApprovedVehicleMake(data.make);
  return approvedMake ? { ...data, make: approvedMake } : null;
}

/** Common faults for one car, most upvoted first. */
export async function fetchCarFaults(carId: string): Promise<CarFault[]> {
  const { data, error } = await supabase
    .from("car_faults")
    .select("*")
    .eq("car_id", carId)
    .order("upvotes", { ascending: false });
  if (error) throw error;
  return data;
}

export async function setCarStatus(carId: string, status: Car["status"]) {
  const { error } = await supabase.from("cars").update({ status }).eq("id", carId);
  if (error) throw error;
}
