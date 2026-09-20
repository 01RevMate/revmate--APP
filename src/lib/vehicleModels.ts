import makeModelMap from "./vehicle-make-model-map.json";

// Derived from https://github.com/arthurkao/vehicle-make-model-data (2001-2015,
// US market) merged with a UK/European-market model list, filtered down to
// only the makes in our CAR_MAKES list. Coverage is still partial — some
// niche badges and anything very recent may be missing — so this is a
// helpful preset list, not an exhaustive one; callers should still let the
// user type a model that isn't listed.
const MAKE_MODEL_MAP = makeModelMap as Record<string, string[]>;

export function getModelsForMake(make: string): string[] {
  return MAKE_MODEL_MAP[make] ?? [];
}
