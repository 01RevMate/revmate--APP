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

// Idempotent: liking an already-liked car must not error (a double-click
// shouldn't throw a unique-violation).
export async function likeGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_likes")
    .upsert(
      { garage_car_id: garageCarId, user_id: userId },
      { onConflict: "garage_car_id,user_id", ignoreDuplicates: true },
    );
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

// Batch check for feed rendering — mirrors fetchMyLikedPostIds in posts.ts,
// so showcase-post car-like state doesn't fire one query per card.
export async function fetchMyLikedGarageCarIds(
  userId: string,
  garageCarIds: string[],
): Promise<Set<string>> {
  if (garageCarIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("garage_car_likes")
    .select("garage_car_id")
    .eq("user_id", userId)
    .in("garage_car_id", garageCarIds);
  if (error) throw error;
  return new Set(data.map((row) => row.garage_car_id));
}

export async function fetchMyDislikedGarageCarIds(
  userId: string,
  garageCarIds: string[],
): Promise<Set<string>> {
  if (garageCarIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("garage_car_dislikes")
    .select("garage_car_id")
    .eq("user_id", userId)
    .in("garage_car_id", garageCarIds);
  if (error) throw error;
  return new Set(data.map((row) => row.garage_car_id));
}

// A like and a dislike on the same car by the same user are mutually
// exclusive — a DB trigger clears the opposite reaction automatically.
export async function dislikeGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_dislikes")
    .upsert(
      { garage_car_id: garageCarId, user_id: userId },
      { onConflict: "garage_car_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function undislikeGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_dislikes")
    .delete()
    .eq("garage_car_id", garageCarId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function hasDislikedGarageCar(garageCarId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("garage_car_dislikes")
    .select("id")
    .eq("garage_car_id", garageCarId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function followGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_follows")
    .upsert(
      { garage_car_id: garageCarId, user_id: userId },
      { onConflict: "garage_car_id,user_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function unfollowGarageCar(garageCarId: string, userId: string) {
  const { error } = await supabase
    .from("garage_car_follows")
    .delete()
    .eq("garage_car_id", garageCarId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function hasFollowedGarageCar(garageCarId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("garage_car_follows")
    .select("id")
    .eq("garage_car_id", garageCarId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export type GarageCarRankEntry = {
  id: string;
  user_id: string;
  username: string;
  nickname: string;
  make: string;
  model: string;
  photo_url: string | null;
  likes_count: number;
  dislikes_count: number;
  followers_count: number;
  net_score: number;
  rank: number;
};

export type GarageCarBrandRankEntry = {
  make: string;
  car_count: number;
  total_likes: number;
  total_dislikes: number;
  net_score: number;
  rank: number;
};

export type GarageCarModelRankEntry = GarageCarBrandRankEntry & { model: string };

// Rank a single car by net score (likes - dislikes) among current cars, via
// a window-function RPC — cheap indexed scan, not a 500-row client fetch.
export async function fetchGarageCarRank(garageCarId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("rank_garage_car", { target_id: garageCarId });
  if (error) throw error;
  return data ?? null;
}

export async function fetchGarageCarLeaderboard(limit = 50, offset = 0): Promise<GarageCarRankEntry[]> {
  const { data, error } = await supabase.rpc("rank_garage_cars", {
    result_limit: limit,
    result_offset: offset,
  });
  if (error) throw error;
  return data;
}

export async function fetchGarageCarBrandLeaderboard(
  limit = 50,
  offset = 0,
): Promise<GarageCarBrandRankEntry[]> {
  const { data, error } = await supabase.rpc("rank_garage_car_brands", {
    result_limit: limit,
    result_offset: offset,
  });
  if (error) throw error;
  return data;
}

export async function fetchGarageCarModelLeaderboard(
  filterMake?: string,
  limit = 50,
  offset = 0,
): Promise<GarageCarModelRankEntry[]> {
  const { data, error } = await supabase.rpc("rank_garage_car_models", {
    ...(filterMake ? { filter_make: filterMake } : {}),
    result_limit: limit,
    result_offset: offset,
  });
  if (error) throw error;
  return data;
}
