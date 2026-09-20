import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GarageCar = Tables<"garage_cars">;
export type GarageMod = Tables<"garage_mods">;
export type GarageCarPhoto = Tables<"garage_car_photos">;

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

export const FUEL_TYPE_LABELS: Record<NonNullable<GarageCar["fuel_type"]>, string> = {
  petrol: "Petrol",
  diesel: "Diesel",
  electric: "Electric",
  hybrid: "Hybrid",
  lpg: "LPG",
  other: "Other",
};

export const TRANSMISSION_LABELS: Record<NonNullable<GarageCar["transmission"]>, string> = {
  manual: "Manual",
  automatic: "Automatic",
  cvt: "CVT",
  dct: "DCT",
  other: "Other",
};

export const OWNERSHIP_STATUS_LABELS: Record<GarageCar["ownership_status"], string> = {
  current: "Current",
  previous: "Previously owned",
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
  catalogMakeId?: string | undefined;
  catalogModelId?: string | undefined;
  catalogDerivativeId?: string | undefined;
  catalogPowertrainId?: string | undefined;
  trim?: string | undefined;
  engine?: string | undefined;
  horsepower?: number | undefined;
  mileage?: number | undefined;
  color?: string | undefined;
  fuelType?: GarageCar["fuel_type"] | undefined;
  transmission?: GarageCar["transmission"] | undefined;
  bio?: string | undefined;
}) {
  const garageCar = {
    user_id: input.userId,
    make: input.make,
    model: input.model,
    nickname: input.nickname,
    generation: input.generation || null,
    year: input.year ?? null,
    spec: input.spec || null,
    photo_url: input.photoUrl || null,
    car_id: input.carId || null,
    catalog_make_id: input.catalogMakeId || null,
    catalog_model_id: input.catalogModelId || null,
    catalog_derivative_id: input.catalogDerivativeId || null,
    catalog_powertrain_id: input.catalogPowertrainId || null,
    trim: input.trim || null,
    engine: input.engine || null,
    horsepower: input.horsepower ?? null,
    mileage: input.mileage ?? null,
    color: input.color || null,
    fuel_type: input.fuelType || null,
    transmission: input.transmission || null,
    bio: input.bio || null,
  };
  const { error } = await supabase.from("garage_cars").insert(garageCar);
  if (!error) return;

  // The bundled catalogue works before its optional link columns are migrated.
  // Keep saving the readable vehicle details on older RevMate databases.
  if (error.message.includes("catalog_") || error.code === "PGRST204") {
    const {
      catalog_make_id: _catalogMakeId,
      catalog_model_id: _catalogModelId,
      catalog_derivative_id: _catalogDerivativeId,
      catalog_powertrain_id: _catalogPowertrainId,
      ...compatibleGarageCar
    } = garageCar;
    const { error: compatibleError } = await supabase
      .from("garage_cars")
      .insert(compatibleGarageCar);
    if (!compatibleError) return;
    throw compatibleError;
  }

  throw error;
}

export async function updateGarageCar(
  id: string,
  fields: Partial<
    Pick<
      GarageCar,
      | "nickname"
      | "photo_url"
      | "spec"
      | "trim"
      | "engine"
      | "horsepower"
      | "mileage"
      | "color"
      | "fuel_type"
      | "transmission"
      | "bio"
    >
  >,
) {
  const { error } = await supabase.from("garage_cars").update(fields).eq("id", id);
  if (error) throw error;
}

export async function removeGarageCar(id: string) {
  const { error } = await supabase.from("garage_cars").delete().eq("id", id);
  if (error) throw error;
}

export async function setGarageCarOwnershipStatus(
  id: string,
  status: GarageCar["ownership_status"],
) {
  const { error } = await supabase
    .from("garage_cars")
    .update({ ownership_status: status })
    .eq("id", id);
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
    .insert({
      garage_car_id: garageCarId,
      title,
      description: description || null,
      category: category || null,
    });
  if (error) throw error;
}

export async function removeMod(id: string) {
  const { error } = await supabase.from("garage_mods").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchCarPhotos(garageCarId: string): Promise<GarageCarPhoto[]> {
  const { data, error } = await supabase
    .from("garage_car_photos")
    .select("*")
    .eq("garage_car_id", garageCarId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addCarPhoto(garageCarId: string, photoUrl: string) {
  const { error } = await supabase
    .from("garage_car_photos")
    .insert({ garage_car_id: garageCarId, photo_url: photoUrl });
  if (error) throw error;
}

export async function removeCarPhoto(id: string) {
  const { error } = await supabase.from("garage_car_photos").delete().eq("id", id);
  if (error) throw error;
}

export async function likeGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_likes")
    .insert({ garage_car_id: garageCarId, user_id: userId });
  if (error) throw error;
}

export async function unlikeGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_likes")
    .delete()
    .eq("garage_car_id", garageCarId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function hasLikedGarageCar(garageCarId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("garage_car_likes")
    .select("id")
    .eq("garage_car_id", garageCarId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Rank a car by likes among all garage cars — fetches a large batch and finds
// the index client-side, same approach as the old app rather than a
// window-function RPC, since supabase-js has no raw-SQL escape hatch here.
export async function fetchGarageCarRank(garageCarId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("garage_cars")
    .select("id, likes_count")
    .order("likes_count", { ascending: false })
    .limit(500);
  if (error) throw error;
  const idx = data.findIndex((c) => c.id === garageCarId);
  return idx >= 0 ? idx + 1 : null;
}
