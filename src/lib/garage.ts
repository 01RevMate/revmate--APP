import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GarageCar = Tables<"garage_cars">;
export type GarageMod = Tables<"garage_mods">;

export async function fetchGarage(userId: string): Promise<GarageCar[]> {
  const { data, error } = await supabase
    .from("garage_cars")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addGarageCar(input: {
  userId: string;
  make: string;
  model: string;
  generation?: string | undefined;
  year?: number | undefined;
  nickname?: string | undefined;
  spec?: string | undefined;
  carId?: string | undefined;
}) {
  const { error } = await supabase.from("garage_cars").insert({
    user_id: input.userId,
    make: input.make,
    model: input.model,
    generation: input.generation || null,
    year: input.year ?? null,
    nickname: input.nickname || null,
    spec: input.spec || null,
    car_id: input.carId || null,
  });
  if (error) throw error;
}

export async function removeGarageCar(id: string) {
  const { error } = await supabase.from("garage_cars").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMods(garageCarId: string): Promise<GarageMod[]> {
  const { data, error } = await supabase
    .from("garage_mods")
    .select("*")
    .eq("garage_car_id", garageCarId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addMod(garageCarId: string, title: string, description?: string) {
  const { error } = await supabase
    .from("garage_mods")
    .insert({ garage_car_id: garageCarId, title, description: description || null });
  if (error) throw error;
}

export async function removeMod(id: string) {
  const { error } = await supabase.from("garage_mods").delete().eq("id", id);
  if (error) throw error;
}
