import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GarageCar = Tables<"garage_cars">;
export type GarageMod = Tables<"garage_mods">;

export const MOD_CATEGORY_LABELS: Record<NonNullable<GarageMod["category"]>, string> = {
  wheels: "Wheels",
  suspension: "Suspension",
  exhaust: "Exhaust",
  intake: "Intake",
  engine: "Engine",
  exterior: "Exterior",
  interior: "Interior",
  lighting: "Lighting",
  audio: "Audio",
  brakes: "Brakes",
  other: "Other",
};

export async function fetchGarage(userId: string): Promise<GarageCar[]> {
  const { data, error } = await supabase
    .from("garage_cars")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchGarageCar(id: string): Promise<GarageCar | null> {
  const { data, error } = await supabase.from("garage_cars").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function addGarageCar(input: {
  userId: string;
  make: string;
  model: string;
  nickname: string;
  generation?: string | undefined;
  year?: number | undefined;
  spec?: string | undefined;
  photoUrl?: string | undefined;
  carId?: string | undefined;
}) {
  const { error } = await supabase.from("garage_cars").insert({
    user_id: input.userId,
    make: input.make,
    model: input.model,
    nickname: input.nickname,
    generation: input.generation || null,
    year: input.year ?? null,
    spec: input.spec || null,
    photo_url: input.photoUrl || null,
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

export async function addMod(
  garageCarId: string,
  title: string,
  description?: string,
  category?: GarageMod["category"],
) {
  const { error } = await supabase
    .from("garage_mods")
    .insert({ garage_car_id: garageCarId, title, description: description || null, category: category || null });
  if (error) throw error;
}

export async function removeMod(id: string) {
  const { error } = await supabase.from("garage_mods").delete().eq("id", id);
  if (error) throw error;
}
