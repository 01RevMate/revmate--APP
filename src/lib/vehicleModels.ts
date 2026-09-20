import makeModelMap from "./vehicle-make-model-map.json";

// Derived from https://github.com/arthurkao/vehicle-make-model-data (2001-2015,
// US market), filtered down to only the makes in our CAR_MAKES list. Coverage
// is partial — UK-only badges like Vauxhall aren't in a US dataset, and
// nothing past 2015 is — so this is a helpful preset list, not an exhaustive
// one; callers should still let the user type a model that isn't listed.
const MAKE_MODEL_MAP = makeModelMap as Record<string, string[]>;

export function getModelsForMake(make: string): string[] {
  return MAKE_MODEL_MAP[make] ?? [];
}
