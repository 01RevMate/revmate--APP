import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  canonicalApprovedVehicleMake,
  filterApprovedVehicleMakes,
} from "@/lib/approvedVehicleMakes";
import type { GarageCar } from "@/lib/garage";

export type VehicleMake = Tables<"vehicle_makes">;
export type VehicleModel = Tables<"vehicle_models">;
export type VehicleDerivative = Tables<"vehicle_derivatives">;
export type VehiclePowertrain = Tables<"vehicle_powertrains">;

type BundledCatalogRow = {
  catalog_entry_id: string;
  make_id: string;
  make: string;
  make_slug: string;
  model_id: string;
  model: string;
  model_slug: string;
  source_generic_model: string;
  derivative_id: string;
  derivative: string;
  derivative_slug: string;
  fuel_type_code: string;
  fuel_type: string;
  engine_sizes_cc: number[];
  engine_size_bands: string[];
  licensed_count: number;
  sorn_count: number;
  current_vehicle_count: number;
  source_period: string;
};

type BundledCatalog = {
  makes: VehicleMake[];
  modelsByMake: Map<string, VehicleModel[]>;
  derivativesByModel: Map<string, VehicleDerivative[]>;
  powertrainsByDerivative: Map<string, VehiclePowertrain[]>;
};

const CATALOG_TIMESTAMP = "2026-09-20T00:00:00.000Z";
const BUNDLED_CATALOG_URL = new URL(
  "../../data/vehicle-catalog/revmate-uk-vehicle-catalog.jsonl.gz",
  import.meta.url,
).href;
let bundledCatalogPromise: Promise<BundledCatalog> | undefined;

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
  engine: string;
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
  engine: "",
};

export async function fetchVehicleMakes() {
  const { data, error } = await supabase.from("vehicle_makes").select("*").order("name").limit(500);
  const approvedMakes = error ? [] : filterApprovedVehicleMakes(data);
  if (approvedMakes.length > 0) return approvedMakes;
  return (await loadBundledCatalog()).makes;
}

export async function fetchVehicleModels(makeId: string) {
  const { data, error } = await supabase
    .from("vehicle_models")
    .select("*")
    .eq("make_id", makeId)
    .order("name")
    .limit(1000);
  if (!error && data.length > 0) return data;
  return (await loadBundledCatalog()).modelsByMake.get(makeId) ?? [];
}

export async function fetchVehicleDerivatives(modelId: string) {
  const { data, error } = await supabase
    .from("vehicle_derivatives")
    .select("*")
    .eq("model_id", modelId)
    .order("name")
    .limit(2000);
  if (!error && data.length > 0) return data;
  return (await loadBundledCatalog()).derivativesByModel.get(modelId) ?? [];
}

export async function fetchVehiclePowertrains(derivativeId: string) {
  const { data, error } = await supabase
    .from("vehicle_powertrains")
    .select("*")
    .eq("derivative_id", derivativeId)
    .order("current_vehicle_count", { ascending: false });
  if (!error && data.length > 0) return data;
  return (await loadBundledCatalog()).powertrainsByDerivative.get(derivativeId) ?? [];
}

function loadBundledCatalog() {
  bundledCatalogPromise ??= buildBundledCatalog().catch((error: unknown) => {
    bundledCatalogPromise = undefined;
    throw error;
  });
  return bundledCatalogPromise;
}

async function buildBundledCatalog(): Promise<BundledCatalog> {
  const response = await fetch(BUNDLED_CATALOG_URL);
  if (!response.ok || !response.body) {
    throw new Error("The RevMate vehicle catalogue could not be loaded.");
  }

  // Nitro/Cloudflare may transparently decode `.gz` responses while Vite may
  // return the raw gzip bytes. Inspect the body so both environments work.
  const bytes = new Uint8Array(await response.arrayBuffer());
  const isRawGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const content = isRawGzip ? await decompressGzipBytes(bytes) : new TextDecoder().decode(bytes);
  const makeMap = new Map<string, VehicleMake>();
  const modelMap = new Map<string, VehicleModel>();
  const derivativeMap = new Map<string, VehicleDerivative>();
  const powertrains: VehiclePowertrain[] = [];
  const lines = content.split("\n");

  const sourceMakes = new Map<string, VehicleMake>();
  for (const line of lines) {
    if (!line) continue;
    const row = JSON.parse(line) as BundledCatalogRow;
    sourceMakes.set(row.make_id, {
      id: row.make_id,
      name: row.make,
      slug: row.make_slug,
      created_at: CATALOG_TIMESTAMP,
    });
  }
  const approvedMakes = filterApprovedVehicleMakes([...sourceMakes.values()]);
  const approvedMakeIds = new Set(approvedMakes.map((make) => make.id));

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const row = JSON.parse(line) as BundledCatalogRow;
    if (!approvedMakeIds.has(row.make_id)) continue;
    const canonicalMake = canonicalApprovedVehicleMake(row.make);
    if (!canonicalMake) continue;

    makeMap.set(row.make_id, {
      id: row.make_id,
      name: canonicalMake,
      slug: row.make_slug,
      created_at: CATALOG_TIMESTAMP,
    });
    modelMap.set(row.model_id, {
      id: row.model_id,
      make_id: row.make_id,
      name: row.model,
      slug: row.model_slug,
      source_generic_model: row.source_generic_model,
      created_at: CATALOG_TIMESTAMP,
    });
    derivativeMap.set(row.derivative_id, {
      id: row.derivative_id,
      model_id: row.model_id,
      name: row.derivative,
      slug: row.derivative_slug,
      created_at: CATALOG_TIMESTAMP,
    });
    powertrains.push({
      id: row.catalog_entry_id,
      derivative_id: row.derivative_id,
      fuel_type_code: row.fuel_type_code,
      fuel_type: row.fuel_type,
      engine_sizes_cc: row.engine_sizes_cc,
      engine_size_bands: row.engine_size_bands,
      licensed_count: row.licensed_count,
      sorn_count: row.sorn_count,
      current_vehicle_count: row.current_vehicle_count,
      source_period: row.source_period,
      created_at: CATALOG_TIMESTAMP,
      updated_at: CATALOG_TIMESTAMP,
    });

    if (index > 0 && index % 2000 === 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    makes: [...makeMap.values()].sort(byName),
    modelsByMake: groupBy([...modelMap.values()].sort(byName), (model) => model.make_id),
    derivativesByModel: groupBy(
      [...derivativeMap.values()].sort(byName),
      (derivative) => derivative.model_id,
    ),
    powertrainsByDerivative: groupBy(
      powertrains.sort((a, b) => b.current_vehicle_count - a.current_vehicle_count),
      (powertrain) => powertrain.derivative_id,
    ),
  };
}

async function decompressGzipBytes(bytes: Uint8Array<ArrayBuffer>) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot open the RevMate vehicle catalogue.");
  }
  const decompressed = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(decompressed).text();
}

function groupBy<T>(rows: T[], getKey: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return groups;
}

function byName<T extends { name: string }>(a: T, b: T) {
  return a.name.localeCompare(b.name);
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

export function engineOptionsForPowertrain(powertrain: VehiclePowertrain) {
  if (powertrain.engine_sizes_cc.length > 0) {
    return [...new Set(powertrain.engine_sizes_cc)]
      .sort((a, b) => a - b)
      .map((cc) => ({
        value: `${cc}cc`,
        label: `${formatLitres(cc)} (${cc}cc)`,
      }));
  }

  if (powertrain.fuel_type_code === "electric") {
    return [{ value: "Electric motor", label: "Electric motor" }];
  }

  const bandOptions = [...new Set(powertrain.engine_size_bands)].sort().map((band) => ({
    value: band,
    label: band,
  }));
  return bandOptions.length > 0
    ? bandOptions
    : [{ value: "Not listed", label: "Engine size not listed" }];
}

function formatLitres(cc: number) {
  const litres = cc / 1000;
  return `${Number.isInteger(litres) ? litres.toFixed(1) : litres.toFixed(2).replace(/0$/, "")}L`;
}
