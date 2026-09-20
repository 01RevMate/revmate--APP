import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { GarageCar } from "@/lib/garage";

export type VehicleMake = Tables<"vehicle_makes">;
export type VehicleModel = Tables<"vehicle_models">;
export type VehicleDerivative = Tables<"vehicle_derivatives">;
export type VehiclePowertrain = Tables<"vehicle_powertrains">;

export type VehicleCatalogSelection = {
  makeId: string;
  make: string;
  modelId: string;
  model: string;
  derivativeId: string;
  derivative: string;
  powertrainId: string;
  fuelTypeCode: string;
  fuelType: string;
};

export const EMPTY_VEHICLE_CATALOG_SELECTION: VehicleCatalogSelection = {
  makeId: "",
  make: "",
  modelId: "",
  model: "",
  derivativeId: "",
  derivative: "",
  powertrainId: "",
  fuelTypeCode: "",
  fuelType: "",
};

export async function fetchVehicleMakes() {
  const { data, error } = await supabase.from("vehicle_makes").select("*").order("name").limit(500);
  if (error) throw error;
  return data;
}

export async function fetchVehicleModels(makeId: string) {
  const { data, error } = await supabase
    .from("vehicle_models")
    .select("*")
    .eq("make_id", makeId)
    .order("name")
    .limit(1000);
  if (error) throw error;
  return data;
}

export async function fetchVehicleDerivatives(modelId: string) {
  const { data, error } = await supabase
    .from("vehicle_derivatives")
    .select("*")
    .eq("model_id", modelId)
    .order("name")
    .limit(2000);
  if (error) throw error;
  return data;
}

export async function fetchVehiclePowertrains(derivativeId: string) {
  const { data, error } = await supabase
    .from("vehicle_powertrains")
    .select("*")
    .eq("derivative_id", derivativeId)
    .order("current_vehicle_count", { ascending: false });
  if (error) throw error;
  return data;
}

export function garageFuelTypeForCatalogFuel(
  fuelTypeCode: string,
): NonNullable<GarageCar["fuel_type"]> {
  if (fuelTypeCode === "petrol") return "petrol";
  if (fuelTypeCode === "diesel") return "diesel";
  if (fuelTypeCode === "electric") return "electric";
  if (fuelTypeCode.includes("hybrid") || fuelTypeCode === "range_extended_electric")
    return "hybrid";
  return "other";
}

export function powertrainLabel(powertrain: VehiclePowertrain) {
  const engines = powertrain.engine_size_bands.join(", ");
  return engines ? `${powertrain.fuel_type} · ${engines}` : powertrain.fuel_type;
}
