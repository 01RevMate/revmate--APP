import { supabase } from "@/integrations/supabase/client";
import { EMPTY_SPECS, type ListingSpecs } from "@/lib/vehicleSpecs";

// Fills an advert from everything RevMate already knows about the car in
// the seller's garage: the garage entry itself, the vehicle catalogue
// (engine size, fuel) and their logged mods. Only empty fields are filled —
// anything the seller typed is never overwritten.

export type GarageFill = { specs: Partial<ListingSpecs>; mileage: number | null; filled: string[] };

const BODY_WORDS: [RegExp, string][] = [
  [/\b(hatch|hatchback)\b/i, "hatchback"],
  [/\b(saloon|sedan)\b/i, "saloon"],
  [/\b(estate|touring|avant|sportwagen|wagon|shooting brake)\b/i, "estate"],
  [/\b(coupe|coupé)\b/i, "coupe"],
  [/\b(convertible|cabrio|cabriolet|roadster|spider|spyder)\b/i, "convertible"],
  [/\b(suv|4x4|crossover)\b/i, "suv"],
  [/\b(mpv|people carrier)\b/i, "mpv"],
  [/\b(pick-?up)\b/i, "pickup"],
  [/\bvan\b/i, "van"],
];

/** "2.0 TDI", "1984cc", "1.6L" → cc. */
function engineCc(text: string | null | undefined): number | null {
  if (!text) return null;
  const cc = /(\d{3,4})\s*cc/i.exec(text);
  if (cc) return Number(cc[1]);
  const litres = /(\d\.\d)\s*(l\b|litre|liter|[a-z])?/i.exec(text);
  return litres ? Math.round(Number(litres[1]) * 1000) : null;
}

export async function fetchGarageFill(garageCarId: string): Promise<GarageFill> {
  const { data: car, error } = await supabase
    .from("garage_cars")
    .select(
      "make, model, year, mileage, color, horsepower, engine, fuel_type, transmission, generation, spec, trim, mot_due, catalog_derivative_id, catalog_powertrain_id",
    )
    .eq("id", garageCarId)
    .maybeSingle();
  if (error || !car) return { specs: {}, mileage: null, filled: [] };

  const [{ data: powertrain }, { data: derivative }, { count: modCount }] = await Promise.all([
    car.catalog_powertrain_id
      ? supabase
          .from("vehicle_powertrains")
          .select("engine_sizes_cc, fuel_type")
          .eq("id", car.catalog_powertrain_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    car.catalog_derivative_id
      ? supabase
          .from("vehicle_derivatives")
          .select("name")
          .eq("id", car.catalog_derivative_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("garage_mods")
      .select("id", { count: "exact", head: true })
      .eq("garage_car_id", garageCarId),
  ]);

  const words = [derivative?.name, car.generation, car.spec, car.trim].filter(Boolean).join(" ");
  const sizes = (powertrain?.engine_sizes_cc ?? []).filter((n) => n > 0);
  const doors = /\b([2-5])\s*-?\s*(dr|door)/i.exec(words);
  const fuel =
    car.fuel_type ?? (powertrain?.fuel_type?.toLowerCase() as ListingSpecs["fuel_type"]) ?? null;

  const specs: Partial<ListingSpecs> = {
    make: car.make,
    model: car.model,
    year: car.year,
    fuel_type:
      fuel &&
      fuel in { petrol: 1, diesel: 1, electric: 1, hybrid: 1, plug_in_hybrid: 1, lpg: 1, other: 1 }
        ? fuel
        : null,
    transmission: car.transmission,
    colour: car.color ? car.color.slice(0, 30) : null,
    power_bhp: car.horsepower,
    // The catalogue's exact size (e.g. 1984) beats rounding "2.0 TSI" to 2000.
    engine_size_cc: sizes.length === 1 ? sizes[0]! : engineCc(car.engine),
    body_type: BODY_WORDS.find(([re]) => re.test(words))?.[1] ?? null,
    doors: doors ? Number(doors[1]) : null,
    mot_expiry: car.mot_due,
    modified: modCount && modCount > 0 ? true : null,
  };
  const clean = Object.fromEntries(
    Object.entries(specs).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  ) as Partial<ListingSpecs>;
  return { specs: clean, mileage: car.mileage, filled: Object.keys(clean) };
}

/** Puts garage values into the empty spec fields only. */
export function mergeEmpty(current: ListingSpecs, fill: Partial<ListingSpecs>) {
  const next = { ...current };
  const added: string[] = [];
  for (const key of Object.keys(EMPTY_SPECS) as (keyof ListingSpecs)[]) {
    const value = fill[key];
    if (value != null && (next[key] == null || next[key] === "")) {
      (next as Record<string, unknown>)[key] = value;
      added.push(key);
    }
  }
  return { next, added };
}
