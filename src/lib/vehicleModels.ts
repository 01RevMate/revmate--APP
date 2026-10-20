import makeModelMap from "./vehicle-make-model-map.json";
import { modelKey, ukModelsForMake } from "./ukModels";

// Current UK models (ukModels.ts, including electric and hybrid models) merged
// with an older dataset derived from
// https://github.com/arthurkao/vehicle-make-model-data (2001-2015, US market)
// and a UK/European-market model list. Coverage is still partial, so this is
// a helpful preset list, not an exhaustive one; callers should still let the
// user type a model that isn't listed.
const MAKE_MODEL_MAP = makeModelMap as Record<string, string[]>;

// The older dataset spells some makes differently from the approved list.
const LEGACY_BY_KEY = new Map(
  Object.entries(MAKE_MODEL_MAP).map(([make, models]) => [modelKey(make), models]),
);
const LEGACY_ALIASES: Record<string, string> = { dsautomobiles: "ds" };

export function getModelsForMake(make: string): string[] {
  const makeKey = modelKey(make);
  const legacy = LEGACY_BY_KEY.get(LEGACY_ALIASES[makeKey] ?? makeKey) ?? [];
  // Current names first so their spelling wins, then fill in older models;
  // duplicates that differ only in case or punctuation ("Leaf" / "LEAF") go.
  const seen = new Set<string>();
  const models: string[] = [];
  for (const model of [...ukModelsForMake(make), ...legacy]) {
    const k = modelKey(model);
    // Old data lists some as bare letters ("S" for Tesla's Model S).
    if (!k || seen.has(k) || seen.has(`model${k}`)) continue;
    seen.add(k);
    models.push(model);
  }
  return models.sort((a, b) => a.localeCompare(b, "en-GB", { numeric: true }));
}
