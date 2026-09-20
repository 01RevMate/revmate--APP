import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Car = Tables<"cars">;
export type CarFault = Tables<"car_faults">;
export type Listing = Tables<"listings">;
export type Question = Tables<"questions">;

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
  return data;
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
  return data;
}
